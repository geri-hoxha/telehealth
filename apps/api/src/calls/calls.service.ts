import { HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-exception';
import { fullName, personInclude, PersonDto, toPersonDto } from '../common/people';
import {
  Prisma,
  type Call,
  type CallAttempt,
  type CallFeedback,
  type CallInvite,
  type CallState,
} from '../generated/prisma/client';
import { LiveKitService } from '../livekit/livekit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import type { UserWithProfile } from '../users/user.dto';
import { UsersService } from '../users/users.service';
import type {
  CallDto,
  CallFeedbackDto,
  CallJoinDto,
  CallParticipantDto,
  CallWithJoinDto,
  CreateCallDto,
  IncomingCallDto,
} from './call.dto';

const ACTIVE_STATES: CallState[] = ['QUEUED', 'RINGING', 'ACCEPTED'];
/** An accepted call that is still open after this long is treated as over (a phone left without hanging up). */
const MAX_CALL_MS = 3 * 60 * 60 * 1000;
/** A doctor without a push device is only rung while their open app has checked for calls this recently. */
const PRESENCE_MS = 30_000;
const HISTORY_PAGE = 30;

const callInclude = {
  patient: { include: personInclude },
  doctor: { include: personInclude },
  attempts: { orderBy: { startedAt: 'asc' } },
  invites: { include: { doctor: { include: personInclude } }, orderBy: { createdAt: 'asc' } },
  feedback: true,
} as const;

type CallRecord = Call & {
  patient: UserWithProfile;
  doctor: UserWithProfile | null;
  attempts: CallAttempt[];
  invites: (CallInvite & { doctor: UserWithProfile })[];
  feedback: CallFeedback | null;
};

/**
 * Patient → doctor calls. The patient never picks the doctor: a call waits in a queue (oldest
 * first) and rings the first free doctor; a doctor who doesn't answer or declines passes it to
 * the next one, and when every reachable doctor has been tried, or the wait is too long, it ends
 * as UNANSWERED ("lines busy").
 *
 * There are no background jobs: `refresh()` runs at the start of call requests, and the waiting
 * patient's app polls every couple of seconds, which keeps the queue moving.
 */
@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  private readonly ringMs: number;
  private readonly ringSeconds: number;
  private readonly maxWaitMs: number;
  private refreshRun: Promise<void> | null = null;
  private refreshAgain = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LiveKitService,
    private readonly push: PushService,
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    this.ringSeconds = Number(config.get('CALL_RING_SECONDS', 45));
    this.ringMs = this.ringSeconds * 1000;
    this.maxWaitMs = Number(config.get('CALL_MAX_WAIT_SECONDS', 300)) * 1000;
  }

  /** A patient calls. They join the room right away and wait there while doctors are rung. */
  async create(patientId: string, dto: CreateCallDto): Promise<CallWithJoinDto> {
    const patient = await this.users.requireRole(patientId, 'PATIENT');
    await this.refresh();
    await this.subscriptions.requireActive(patientId);

    const block = await this.prisma.patientBlock.findFirst({
      where: { patientId, liftedAt: null, endsAt: { gt: new Date() } },
      orderBy: { endsAt: 'desc' },
    });
    if (block) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'PATIENT_BLOCKED', 'Calling is blocked for now', {
        until: block.endsAt,
      });
    }
    if (await this.prisma.call.findFirst({ where: { patientId, state: { in: ACTIVE_STATES } } })) {
      throw new ApiException(HttpStatus.CONFLICT, 'CALL_ALREADY_ACTIVE', 'You are already in a call');
    }

    let preferredDoctorId = dto.preferredDoctorId ?? null;
    if (dto.eventId) {
      preferredDoctorId = await this.eventSpecialist(patientId, dto.eventId);
    } else if (preferredDoctorId && !(await this.prisma.user.count({ where: { id: preferredDoctorId, role: 'DOCTOR' } }))) {
      preferredDoctorId = null;
    }
    if ((await this.reachableDoctorIds()).length === 0) {
      throw new ApiException(HttpStatus.CONFLICT, 'NO_DOCTOR_AVAILABLE', 'No doctor is available right now');
    }
    this.livekit.requireConfigured();

    let call: Call;
    try {
      call = await this.prisma.call.create({
        data: { patientId, media: dto.media, preferredDoctorId, eventId: dto.eventId ?? null },
      });
    } catch (error) {
      // Lost a race with another call of the same patient (partial unique index).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiException(HttpStatus.CONFLICT, 'CALL_ALREADY_ACTIVE', 'You are already in a call');
      }
      throw error;
    }

    let join: CallJoinDto;
    try {
      join = await this.livekit.createJoin(roomName(call.id), patient.id);
    } catch (error) {
      await this.finish(call, ACTIVE_STATES, 'FAILED');
      throw error;
    }

    // Rings the first free doctor now rather than on the next poll.
    await this.refresh();
    return { call: await this.detail(call.id, patientId), join };
  }

  async get(userId: string, callId: string): Promise<CallDto> {
    await this.refresh();
    await this.requireParticipant(userId, callId);
    return this.detail(callId, userId);
  }

  /** Newest first. Patients see all their calls; doctors the ones they answered or were added to. */
  async history(userId: string, before?: Date): Promise<CallDto[]> {
    const user = await this.users.require(userId);
    await this.refresh();
    const where: Prisma.CallWhereInput =
      user.role === 'PATIENT'
        ? { patientId: userId }
        : {
            OR: [
              { doctorId: userId, answeredAt: { not: null } },
              { invites: { some: { doctorId: userId, state: { in: ['ACCEPTED', 'LEFT'] } } } },
            ],
          };
    const calls = await this.prisma.call.findMany({
      where: { ...where, ...(before ? { createdAt: { lt: before } } : {}) },
      include: callInclude,
      orderBy: { createdAt: 'desc' },
      take: HISTORY_PAGE,
    });
    return calls.map((call) => toCallDto(call, userId));
  }

  /**
   * Doctor: the call ringing for me right now, if any. Lets an open app ring without a push, and
   * marks the doctor as reachable.
   */
  async incoming(doctorId: string): Promise<IncomingCallDto> {
    await this.prisma.user.updateMany({ where: { id: doctorId, role: 'DOCTOR' }, data: { lastSeenAt: new Date() } });
    await this.refresh();

    const call = await this.prisma.call.findFirst({ where: { doctorId, state: 'RINGING' }, include: callInclude });
    if (call) {
      const attempt = call.attempts.find((item) => item.doctorId === doctorId && item.outcome === 'RINGING');
      return { call: await this.detail(call.id, doctorId), ringId: attempt?.id ?? call.id };
    }
    const invite = await this.prisma.callInvite.findFirst({
      where: { doctorId, state: 'RINGING', call: { state: 'ACCEPTED' } },
    });
    if (invite) {
      return { call: await this.detail(invite.callId, doctorId), ringId: invite.id };
    }
    return { call: null, ringId: null };
  }

  /** The doctor answers (the call, or an "Add doctor" invite) and gets a token for the room. */
  async accept(doctorId: string, callId: string): Promise<CallWithJoinDto> {
    await this.refresh();
    const call = await this.requireParticipant(doctorId, callId);
    const invite = call.invites.find((item) => item.doctorId === doctorId && item.state === 'RINGING');
    const now = new Date();

    if (invite) {
      if (call.state !== 'ACCEPTED') throw conflict(call.state);
      const { count } = await this.prisma.callInvite.updateMany({
        where: { id: invite.id, state: 'RINGING' },
        data: { state: 'ACCEPTED', answeredAt: now },
      });
      if (count === 0) throw conflict(call.state);
    } else {
      if (call.state !== 'RINGING' || call.doctorId !== doctorId) throw conflict(call.state);
      const accepted = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.call.updateMany({
          where: { id: callId, state: 'RINGING', doctorId },
          data: { state: 'ACCEPTED', answeredAt: now },
        });
        if (count === 0) return false;
        await tx.callAttempt.updateMany({
          where: { callId, doctorId, outcome: 'RINGING' },
          data: { outcome: 'ACCEPTED', endedAt: now },
        });
        return true;
      });
      if (!accepted) throw conflict((await this.reload(callId)).state);
    }

    try {
      const join = await this.livekit.createJoin(roomName(callId), doctorId);
      return { call: await this.detail(callId, doctorId), join };
    } catch (error) {
      this.logger.error(`Could not create the doctor's token for call ${callId}: ${String(error)}`);
      if (invite) {
        await this.prisma.callInvite.update({ where: { id: invite.id }, data: { state: 'LEFT', endedAt: new Date() } });
      } else {
        await this.finish(call, ['ACCEPTED'], 'FAILED');
      }
      throw error;
    }
  }

  /** The doctor rejects a ringing call, which then rings the next free doctor. 409 once it stopped ringing. */
  async decline(doctorId: string, callId: string): Promise<CallDto> {
    await this.refresh();
    const call = await this.requireParticipant(doctorId, callId);
    const invite = call.invites.find((item) => item.doctorId === doctorId && item.state === 'RINGING');
    if (invite) {
      await this.prisma.callInvite.updateMany({
        where: { id: invite.id, state: 'RINGING' },
        data: { state: 'DECLINED', endedAt: new Date() },
      });
    } else if (call.state === 'RINGING' && call.doctorId === doctorId) {
      if (!(await this.requeue(call, 'DECLINED'))) throw conflict((await this.reload(callId)).state);
      await this.refresh();
    } else {
      throw conflict(call.state);
    }
    return this.detail(callId, doctorId);
  }

  /**
   * Hangs up. The patient cancels a waiting call or ends an answered one for everyone; the
   * answering doctor ends it for everyone (or passes it on while it rings); an added doctor only
   * leaves. Calling it on a call that is already over does nothing.
   */
  async end(userId: string, callId: string): Promise<CallDto> {
    await this.refresh();
    const call = await this.requireParticipant(userId, callId);
    const invite = call.invites.find((item) => item.doctorId === userId && ['RINGING', 'ACCEPTED'].includes(item.state));

    if (call.patientId === userId) {
      if (call.state === 'ACCEPTED') await this.finish(call, ['ACCEPTED'], 'ENDED');
      else await this.finish(call, ['QUEUED', 'RINGING'], 'CANCELED');
    } else if (call.doctorId === userId && call.state === 'ACCEPTED') {
      await this.finish(call, ['ACCEPTED'], 'ENDED');
    } else if (call.doctorId === userId && call.state === 'RINGING') {
      if (await this.requeue(call, 'DECLINED')) await this.refresh();
    } else if (invite) {
      await this.prisma.callInvite.updateMany({
        where: { id: invite.id, state: invite.state },
        data: { state: invite.state === 'RINGING' ? 'DECLINED' : 'LEFT', endedAt: new Date() },
      });
    }
    return this.detail(callId, userId);
  }

  /** Doctor, during a call: free doctors who can be added, searched by name or specialty. */
  async availableDoctors(doctorId: string, query?: string): Promise<PersonDto[]> {
    await this.users.requireRole(doctorId, 'DOCTOR');
    const words = (query ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
    const doctors = await this.freeDoctors({
      exclude: [doctorId],
      only: await this.reachableDoctorIds(),
      where: {
        AND: words.map((word) => ({
          OR: [
            { firstName: { contains: word, mode: 'insensitive' } },
            { lastName: { contains: word, mode: 'insensitive' } },
            { doctorProfile: { specialty: { contains: word, mode: 'insensitive' } } },
          ],
        })),
      },
    });
    return doctors.map(toPersonDto);
  }

  /** "Add doctor": rings another free doctor into this answered call. */
  async invite(doctorId: string, callId: string, invitedId: string): Promise<CallDto> {
    await this.refresh();
    const call = await this.requireParticipant(doctorId, callId);
    if (call.doctorId !== doctorId || call.state !== 'ACCEPTED') throw conflict(call.state);
    const [free] = await this.freeDoctors({ exclude: [doctorId], only: [invitedId] });
    if (!free) {
      throw new ApiException(HttpStatus.CONFLICT, 'DOCTOR_BUSY', 'That doctor is not free right now');
    }

    let inviteId: string;
    try {
      ({ id: inviteId } = await this.prisma.callInvite.create({
        data: { callId, doctorId: invitedId, invitedById: doctorId },
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiException(HttpStatus.CONFLICT, 'DOCTOR_BUSY', 'That doctor is not free right now');
      }
      throw error;
    }
    void this.push.sendIncomingCall(
      invitedId,
      { ringId: inviteId, callId, callerId: call.patientId, media: call.media },
      this.ringSeconds,
    );
    return this.detail(callId, doctorId);
  }

  /** The patient rates a call that took place. Can be changed later. */
  async feedback(patientId: string, callId: string, dto: CallFeedbackDto): Promise<CallDto> {
    const call = await this.requireParticipant(patientId, callId, 'patient');
    if (!call.answeredAt || call.state !== 'ENDED') {
      throw new ApiException(HttpStatus.CONFLICT, 'CALL_NOT_FINISHED', 'Only finished calls can be rated');
    }
    const data = { rating: dto.rating, comment: dto.comment ?? null };
    await this.prisma.callFeedback.upsert({ where: { callId }, create: { callId, ...data }, update: data });
    return this.detail(callId, patientId);
  }

  /** "Free line": tells the patient this doctor can take their call now ("Call now" rings them first). */
  async freeLine(doctorId: string, callId: string): Promise<void> {
    const doctor = await this.users.requireRole(doctorId, 'DOCTOR');
    const call = await this.requireParticipant(doctorId, callId);
    await this.notifications.notify(call.patientId, {
      type: 'FREE_LINE',
      params: { doctor: fullName(doctor) },
      doctorId,
    });
  }

  // --- the queue ---

  /**
   * Brings every call up to date: expires rings and waits that ran out, then rings free doctors
   * for waiting calls. One run at a time; a request that arrives during a run waits for one more.
   */
  private refresh(): Promise<void> {
    if (this.refreshRun) {
      this.refreshAgain = true;
      return this.refreshRun;
    }
    this.refreshRun = (async () => {
      try {
        do {
          this.refreshAgain = false;
          await this.expire();
          await this.dispatch();
        } while (this.refreshAgain);
      } catch (error) {
        this.logger.error(`Updating calls failed: ${String(error)}`);
      } finally {
        this.refreshRun = null;
      }
    })();
    return this.refreshRun;
  }

  private async expire(): Promise<void> {
    const now = Date.now();
    const ringCutoff = new Date(now - this.ringMs);

    const unanswered = await this.prisma.call.findMany({ where: { state: 'RINGING', ringingAt: { lt: ringCutoff } } });
    for (const call of unanswered) await this.requeue(call, 'NO_ANSWER');

    await this.prisma.callInvite.updateMany({
      where: { state: 'RINGING', createdAt: { lt: ringCutoff } },
      data: { state: 'NO_ANSWER', endedAt: new Date() },
    });

    const waitedTooLong = await this.prisma.call.findMany({
      where: { state: 'QUEUED', createdAt: { lt: new Date(now - this.maxWaitMs) } },
    });
    for (const call of waitedTooLong) await this.finish(call, ['QUEUED'], 'UNANSWERED');

    const leftOpen = await this.prisma.call.findMany({
      where: { state: 'ACCEPTED', answeredAt: { lt: new Date(now - MAX_CALL_MS) } },
    });
    for (const call of leftOpen) await this.finish(call, ['ACCEPTED'], 'ENDED');
  }

  /** Rings a free doctor for each waiting call, oldest call first. */
  private async dispatch(): Promise<void> {
    const queued = await this.prisma.call.findMany({
      where: { state: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      include: { attempts: { select: { doctorId: true } } },
    });
    if (queued.length === 0) return;
    const reachable = await this.reachableDoctorIds();

    for (const call of queued) {
      const tried = call.attempts.map((attempt) => attempt.doctorId);
      if (!reachable.some((id) => !tried.includes(id))) {
        // Every doctor who could ring has been tried: lines busy.
        await this.finish(call, ['QUEUED'], 'UNANSWERED');
        continue;
      }
      const [doctor] = await this.freeDoctors({ exclude: tried, only: reachable, preferredId: call.preferredDoctorId });
      if (doctor) await this.ring(call, doctor.id);
    }
  }

  /** Moves a waiting call to a doctor and rings their phones. */
  private async ring(call: Call, doctorId: string): Promise<void> {
    let attempt: CallAttempt | null;
    try {
      attempt = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.call.updateMany({
          where: { id: call.id, state: 'QUEUED' },
          data: { state: 'RINGING', doctorId, ringingAt: new Date() },
        });
        return count === 0 ? null : tx.callAttempt.create({ data: { callId: call.id, doctorId } });
      });
    } catch (error) {
      // The doctor was just given another call (one active call per doctor).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
    if (!attempt) return;
    void this.push.sendIncomingCall(
      doctorId,
      { ringId: attempt.id, callId: call.id, callerId: call.patientId, media: call.media },
      this.ringSeconds,
    );
  }

  /** Puts a ringing call back in the queue; the next run tries another doctor. False if it no longer rang. */
  private async requeue(call: Call, outcome: 'NO_ANSWER' | 'DECLINED'): Promise<boolean> {
    const doctorId = call.doctorId;
    if (!doctorId) return false;
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.call.updateMany({
        where: { id: call.id, state: 'RINGING', doctorId },
        data: { state: 'QUEUED', doctorId: null, ringingAt: null },
      });
      if (count === 0) return false;
      await tx.callAttempt.updateMany({
        where: { callId: call.id, doctorId, outcome: 'RINGING' },
        data: { outcome, endedAt: new Date() },
      });
      return true;
    });
  }

  /**
   * Ends a call if it is still in one of `from`: records the final state, stops rings and invites,
   * and closes the LiveKit room, which disconnects every phone. A doctor's phone that is still
   * ringing notices through the API (or stops at its ring timeout). False if it was already over.
   */
  private async finish(call: Call, from: CallState[], to: CallState): Promise<boolean> {
    const now = new Date();
    const { count } = await this.prisma.call.updateMany({
      where: { id: call.id, state: { in: from } },
      data: { state: to, endedAt: now },
    });
    if (count === 0) return false;
    await this.prisma.$transaction([
      this.prisma.callAttempt.updateMany({
        where: { callId: call.id, outcome: 'RINGING' },
        data: { outcome: to === 'CANCELED' ? 'CANCELED' : 'FAILED', endedAt: now },
      }),
      this.prisma.callInvite.updateMany({
        where: { callId: call.id, state: 'RINGING' },
        data: { state: 'CANCELED', endedAt: now },
      }),
      this.prisma.callInvite.updateMany({
        where: { callId: call.id, state: 'ACCEPTED' },
        data: { state: 'LEFT', endedAt: now },
      }),
    ]);
    void this.livekit.deleteRoom(roomName(call.id));
    return true;
  }

  /** Doctors whose phone can ring: a push device, or the app open recently. */
  private async reachableDoctorIds(): Promise<string[]> {
    const doctors = await this.prisma.user.findMany({
      where: {
        role: 'DOCTOR',
        OR: [
          { devices: { some: { kind: { in: ['VOIP', 'FCM'] } } } },
          { lastSeenAt: { gt: new Date(Date.now() - PRESENCE_MS) } },
        ],
      },
      select: { id: true },
    });
    return doctors.map((doctor) => doctor.id);
  }

  /**
   * Doctors not in or ringing for a call, preferred doctor first, then those with a push device.
   * A call the patient cancelled can keep ringing on a closed app until the phone's own ring
   * timeout, and the phone drops a new ring meanwhile, so that doctor isn't free yet either.
   */
  private async freeDoctors({
    exclude = [],
    only,
    preferredId,
    where = {},
  }: {
    exclude?: string[];
    only?: string[];
    preferredId?: string | null;
    where?: Prisma.UserWhereInput;
  }): Promise<UserWithProfile[]> {
    const mayStillRing = new Date(Date.now() - this.ringMs);
    const doctors = await this.prisma.user.findMany({
      where: {
        ...where,
        role: 'DOCTOR',
        id: { notIn: exclude, ...(only ? { in: only } : {}) },
        doctorCalls: { none: { state: { in: ['RINGING', 'ACCEPTED'] } } },
        callAttempts: { none: { outcome: 'CANCELED', startedAt: { gt: mayStillRing } } },
        callInvites: {
          none: {
            OR: [{ state: { in: ['RINGING', 'ACCEPTED'] } }, { state: 'CANCELED', createdAt: { gt: mayStillRing } }],
          },
        },
      },
      include: { ...personInclude, _count: { select: { devices: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const rank = (doctor: (typeof doctors)[number]) =>
      (doctor.id === preferredId ? 0 : 2) + (doctor._count.devices > 0 ? 0 : 1);
    return doctors.sort((a, b) => rank(a) - rank(b));
  }

  /** "Request a call" in a live event the patient joined: its specialist is rung first. */
  private async eventSpecialist(patientId: string, eventId: string): Promise<string> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { participants: { where: { userId: patientId } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.participants.length === 0) {
      throw new ApiException(HttpStatus.CONFLICT, 'EVENT_NOT_JOINED', 'Join the event first');
    }
    const now = new Date();
    if (event.startsAt > now || event.endsAt <= now) {
      throw new ApiException(HttpStatus.CONFLICT, 'EVENT_NOT_LIVE', 'The event is not happening now');
    }
    return event.specialistId;
  }

  // --- loading ---

  /** A call the user takes part in: the patient, a doctor who was rung, or an added doctor. Else 404. */
  private async requireParticipant(userId: string, callId: string, side?: 'patient'): Promise<CallRecord> {
    const call = await this.prisma.call.findUnique({ where: { id: callId }, include: callInclude });
    const allowed =
      call &&
      (call.patientId === userId ||
        (side !== 'patient' &&
          (call.doctorId === userId ||
            call.attempts.some((attempt) => attempt.doctorId === userId) ||
            call.invites.some((invite) => invite.doctorId === userId))));
    if (!call || !allowed) throw new NotFoundException('Call not found');
    return call;
  }

  private reload(callId: string): Promise<CallRecord> {
    return this.prisma.call.findUniqueOrThrow({ where: { id: callId }, include: callInclude });
  }

  /** The call with what one screen needs: the queue position, and the patient's plan for doctors. */
  private async detail(callId: string, viewerId: string): Promise<CallDto> {
    const call = await this.reload(callId);
    const dto = toCallDto(call, viewerId);
    if (call.state === 'QUEUED') {
      dto.queuePosition = await this.prisma.call.count({
        where: { state: 'QUEUED', createdAt: { lt: call.createdAt } },
      });
    }
    if (viewerId !== call.patientId) {
      const plan = await this.subscriptions.active(call.patientId);
      dto.patientPlan = plan ? { planName: plan.planName, startsAt: plan.startsAt, endsAt: plan.endsAt } : null;
    }
    return dto;
  }
}

function toCallDto(call: CallRecord, viewerId: string): CallDto {
  const participants: CallParticipantDto[] = [{ ...toPersonDto(call.patient), role: 'PATIENT' }];
  if (call.doctor && call.answeredAt) participants.push({ ...toPersonDto(call.doctor), role: 'DOCTOR' });
  for (const invite of call.invites) {
    if (invite.answeredAt) participants.push({ ...toPersonDto(invite.doctor), role: 'ADDED_DOCTOR' });
  }
  const ringingForMe =
    (call.state === 'RINGING' && call.doctorId === viewerId) ||
    (call.state === 'ACCEPTED' && call.invites.some((invite) => invite.doctorId === viewerId && invite.state === 'RINGING'));

  return {
    id: call.id,
    state: call.state,
    media: call.media,
    patient: toPersonDto(call.patient),
    doctor: call.doctor ? toPersonDto(call.doctor) : null,
    createdAt: call.createdAt,
    ringingAt: call.ringingAt,
    answeredAt: call.answeredAt,
    endedAt: call.endedAt,
    durationSeconds:
      call.answeredAt && call.endedAt ? Math.round((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000) : null,
    queuePosition: null,
    attemptCount: call.attempts.length,
    ringingForMe,
    participants,
    feedback: call.feedback ? { rating: call.feedback.rating, comment: call.feedback.comment } : null,
    patientPlan: null,
    eventId: call.eventId,
  };
}

function conflict(state: CallState): ApiException {
  return new ApiException(HttpStatus.CONFLICT, 'CALL_STATE_CONFLICT', `The call is ${state.toLowerCase()}`, { state });
}

/** Each call gets its own LiveKit room. LiveKit creates it when the patient joins. */
function roomName(callId: string): string {
  return `call-${callId}`;
}
