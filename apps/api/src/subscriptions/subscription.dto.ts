import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, Matches } from 'class-validator';
import type { Claim, InsurancePolicy, Subscription } from '../generated/prisma/client';
import { ClaimStatus, PolicyType, SubscriptionSource } from '../generated/prisma/enums';

const compact = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/[\s-]+/g, '').toUpperCase() : value;

export class ActivateInsuranceDto {
  @ApiProperty({ enum: PolicyType })
  @IsEnum(PolicyType)
  policyType: PolicyType;

  @ApiProperty({ example: '4021883011230042' })
  @Transform(compact)
  @Matches(/^[A-Z0-9]{6,24}$/, { message: 'cardNumber must be 6-24 letters or digits' })
  cardNumber: string;
}

export class RedeemPrepaidDto {
  @ApiProperty({ example: 'TH-30-DEMO' })
  @Transform(compact)
  @Matches(/^[A-Z0-9]{4,24}$/, { message: 'code must be 4-24 letters or digits' })
  code: string;
}

export class SubscriptionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: SubscriptionSource })
  source: SubscriptionSource;

  @ApiPropertyOptional({ enum: PolicyType, nullable: true })
  policyType: PolicyType | null;

  @ApiProperty({ example: 'Premium' })
  planName: string;

  @ApiProperty({ description: 'The number on the digital health card' })
  cardNumber: string;

  @ApiProperty()
  startsAt: Date;

  @ApiProperty()
  endsAt: Date;

  @ApiProperty()
  isActive: boolean;
}

export class SubscriptionOverviewDto {
  @ApiPropertyOptional({ type: SubscriptionDto, nullable: true })
  active: SubscriptionDto | null;

  @ApiProperty({ type: SubscriptionDto, isArray: true, description: 'Newest first, including the active one' })
  history: SubscriptionDto[];

  @ApiProperty({ description: 'Whether a demo subscription can still be requested' })
  demoAvailable: boolean;
}

export class ClaimDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'DM-2026-00184' })
  number: string;

  @ApiProperty({ example: 'Analiza gjaku' })
  title: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  provider: string | null;

  @ApiProperty({ example: '4500.00', description: 'Decimal string' })
  amount: string;

  @ApiProperty({ example: 'ALL' })
  currency: string;

  @ApiProperty({ enum: ClaimStatus })
  status: ClaimStatus;

  @ApiProperty()
  submittedAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export function toSubscriptionDto(
  subscription: Subscription & { policy?: InsurancePolicy | null },
  now = new Date(),
): SubscriptionDto {
  return {
    id: subscription.id,
    source: subscription.source,
    policyType: subscription.policy?.type ?? null,
    planName: subscription.planName,
    cardNumber: subscription.cardNumber,
    startsAt: subscription.startsAt,
    endsAt: subscription.endsAt,
    isActive: subscription.startsAt <= now && subscription.endsAt > now,
  };
}

export function toClaimDto(claim: Claim): ClaimDto {
  return {
    id: claim.id,
    number: claim.number,
    title: claim.title,
    provider: claim.provider,
    amount: claim.amount.toFixed(2),
    currency: claim.currency,
    status: claim.status,
    submittedAt: claim.submittedAt,
    updatedAt: claim.updatedAt,
  };
}
