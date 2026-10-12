import { randomInt } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-exception';
import { formatDate } from '../common/language';
import type { Subscription } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  toClaimDto,
  toSubscriptionDto,
  type ActivateInsuranceDto,
  type ClaimDto,
  type SubscriptionDto,
  type SubscriptionOverviewDto,
} from './subscription.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_DAYS = 14;
const DEMO_PLAN = 'Demo';

/**
 * A patient's subscription ("My registration"). Calls, events and comments need an active one.
 * It comes from an insurance policy, a prepaid card code, or a one-time demo.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The subscription valid right now, if any (the one lasting longest when several overlap). */
  active(userId: string): Promise<Subscription | null> {
    const now = new Date();
    return this.prisma.subscription.findFirst({
      where: { userId, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
    });
  }

  /** Throws 403 SUBSCRIPTION_REQUIRED for a patient without an active subscription. */
  async requireActive(userId: string): Promise<void> {
    if (!(await this.active(userId))) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'SUBSCRIPTION_REQUIRED', 'An active subscription is required');
    }
  }

  async overview(userId: string): Promise<SubscriptionOverviewDto> {
    await this.users.requireRole(userId, 'PATIENT');
    const [subscriptions, active] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { userId },
        include: { policy: true },
        orderBy: { startsAt: 'desc' },
      }),
      this.active(userId),
    ]);
    const now = new Date();
    const activeOne = subscriptions.find((subscription) => subscription.id === active?.id);
    return {
      active: activeOne ? toSubscriptionDto(activeOne, now) : null,
      history: subscriptions.map((subscription) => toSubscriptionDto(subscription, now)),
      demoAvailable: !subscriptions.some((subscription) => subscription.source === 'DEMO'),
    };
  }

  /** Links an insurer's policy to the patient. Valid for the policy's own dates. */
  async activateInsurance(userId: string, dto: ActivateInsuranceDto): Promise<SubscriptionDto> {
    await this.users.requireRole(userId, 'PATIENT');
    const policy = await this.prisma.insurancePolicy.findUnique({
      where: { type_cardNumber: { type: dto.policyType, cardNumber: dto.cardNumber } },
      include: { subscription: true },
    });
    if (!policy) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'POLICY_NOT_FOUND', 'No policy with this type and card number');
    }
    if (policy.validTo <= new Date()) {
      throw new ApiException(HttpStatus.CONFLICT, 'POLICY_EXPIRED', 'The policy has expired');
    }
    if (policy.subscription) {
      const code = policy.subscription.userId === userId ? 'POLICY_ALREADY_ACTIVE' : 'POLICY_IN_USE';
      throw new ApiException(HttpStatus.CONFLICT, code, 'The policy is already linked to an account');
    }
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        source: 'INSURANCE',
        planName: policy.planName,
        cardNumber: policy.cardNumber,
        policyId: policy.id,
        startsAt: policy.validFrom,
        endsAt: policy.validTo,
      },
      include: { policy: true },
    });
    await this.notifyActivated(userId, subscription);
    return toSubscriptionDto(subscription);
  }

  /** A prepaid card adds its days after any subscription the patient already has. */
  async redeemPrepaid(userId: string, code: string): Promise<SubscriptionDto> {
    await this.users.requireRole(userId, 'PATIENT');
    const card = await this.prisma.prepaidCard.findUnique({ where: { code } });
    if (!card) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'CODE_NOT_FOUND', 'No prepaid card with this code');
    }
    const startsAt = await this.nextStart(userId);
    const subscription = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.prepaidCard.updateMany({
        where: { id: card.id, redeemedAt: null },
        data: { redeemedAt: new Date() },
      });
      if (count === 0) {
        throw new ApiException(HttpStatus.CONFLICT, 'CODE_ALREADY_USED', 'This code has already been used');
      }
      return tx.subscription.create({
        data: {
          userId,
          source: 'PREPAID',
          planName: card.planName,
          cardNumber: newCardNumber(),
          prepaidCardId: card.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + card.durationDays * DAY_MS),
        },
      });
    });
    await this.notifyActivated(userId, subscription);
    return toSubscriptionDto(subscription);
  }

  /** A one-time 14-day demo. There's no admin approval yet, so it starts right away. */
  async requestDemo(userId: string): Promise<SubscriptionDto> {
    await this.users.requireRole(userId, 'PATIENT');
    if (await this.prisma.subscription.findFirst({ where: { userId, source: 'DEMO' } })) {
      throw new ApiException(HttpStatus.CONFLICT, 'DEMO_ALREADY_USED', 'The demo subscription was already used');
    }
    const startsAt = await this.nextStart(userId);
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        source: 'DEMO',
        planName: DEMO_PLAN,
        cardNumber: newCardNumber(),
        startsAt,
        endsAt: new Date(startsAt.getTime() + DEMO_DAYS * DAY_MS),
      },
    });
    await this.notifyActivated(userId, subscription);
    return toSubscriptionDto(subscription);
  }

  async claims(userId: string): Promise<ClaimDto[]> {
    await this.users.requireRole(userId, 'PATIENT');
    const claims = await this.prisma.claim.findMany({ where: { userId }, orderBy: { submittedAt: 'desc' } });
    return claims.map(toClaimDto);
  }

  /** Now, or when the patient's latest subscription ends. */
  private async nextStart(userId: string): Promise<Date> {
    const latest = await this.prisma.subscription.findFirst({ where: { userId }, orderBy: { endsAt: 'desc' } });
    const now = new Date();
    return latest && latest.endsAt > now ? latest.endsAt : now;
  }

  private notifyActivated(userId: string, subscription: Subscription): Promise<void> {
    return this.notifications.notify(userId, {
      type: 'SUBSCRIPTION_ACTIVATED',
      params: { plan: subscription.planName, date: formatDate(subscription.endsAt) },
    });
  }
}

/** 16 digits starting with 7700, for cards that don't come from an insurer. */
function newCardNumber(): string {
  let digits = '7700';
  while (digits.length < 16) digits += String(randomInt(0, 10));
  return digits;
}
