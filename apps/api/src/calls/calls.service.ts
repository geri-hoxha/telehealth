import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Call, type CallMedia, type CallState, type User } from '../generated/prisma/client';
import { LiveKitService } from '../livekit/livekit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { CallDto, CallJoinDto, CallWithJoinDto } from './call.dto';

const ACTIVE_STATES: CallState[] = ['RINGING', 'ACCEPTED'];
/** An accepted call that is still open after this long is treated as over (a phone left without hanging up). */
const MAX_CALL_MS = 3 * 60 * 60 * 1000;

type CallWithParties = Call & { patient: User; doctor: User };
const withParties = { patient: true, doctor: true } as const;

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);
  private readonly ringSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LiveKitService,
    private readonly push: PushService,
    config: ConfigService,
  ) {
    this.ringSeconds = Number(config.get('CALL_RING_SECONDS', 45));
  }

  /** A patient calls the first free doctor. The patient joins the room right away and waits there. */
  async create(patientId: string, media: CallMedia): Promise<CallWithJoinDto> {
    const patient = await this.requireUser(patientId);
    if (patient.role !== 'PATIENT') {
      throw new ForbiddenException('Only patients can start calls');
    }
    await this.expireStaleCalls();

    if (await this.prisma.call.findFirst({ where: { patientId, state: { in: ACTIVE_STATES } } })) {
      throw new ConflictException({ code: 'CALL_ALREADY_ACTIVE', message: 'You are already in a call' });
    }
    const doctor = await this.findFreeDoctor();
    if (!doctor) {
      throw new ConflictException({ code: 'NO_DOCTOR_AVAILABLE', message: 'No doctor is available right now' });
    }
    this.livekit.requireConfigured();

    let call: CallWithParties;
    try {
      call = await this.prisma.call.create({
        data: { patientId, doctorId: doctor.id, media },
        include: withParties,
      });
    } catch (error) {
      // Lost a race with another call for the same patient or doctor (partial unique indexes).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'CALL_ALREADY_ACTIVE', message: 'The patient or doctor is already in a call' });
      }
      throw error;
    }

    let join: CallJoinDto;
    try {
      join = await this.joinInfo(call.id, patient);
    } catch (error) {
      await this.finish(call, ['RINGING'], 'FAILED');
      throw error;
    }

    void this.push.sendIncomingCall(
      doctor.id,
      { callId: call.id, callerId: patient.id, media },
      this.ringSeconds,
    );

    return { call: toCallDto(call), join };
  }

  async get(userId: string, callId: string): Promise<CallDto> {
    await this.expireStaleCalls();
    return toCallDto(await this.requireParticipant(userId, callId));
  }

  /** The call currently ringing for this doctor, if any. Lets an open app ring without a push. */
  async incoming(doctorId: string): Promise<CallDto | null> {
    await this.expireStaleCalls();
    const call = await this.prisma.call.findFirst({
      where: { doctorId, state: 'RINGING' },
      include: withParties,
    });
    return call ? toCallDto(call) : null;
  }

  /** The doctor answers and gets a token for the room the patient is waiting in. */
  async accept(doctorId: string, callId: string): Promise<CallWithJoinDto> {
    await this.expireStaleCalls();
    const call = await this.requireParticipant(doctorId, callId, 'doctor');
    await this.transition(call, ['RINGING'], 'ACCEPTED', { answeredAt: new Date() });

    try {
      const join = await this.joinInfo(call.id, call.doctor);
      return { call: toCallDto(await this.reload(callId)), join };
    } catch (error) {
      this.logger.error(`Could not create the doctor's token for call ${callId}: ${String(error)}`);
      await this.finish(call, ['ACCEPTED'], 'FAILED');
      throw error;
    }
  }

  async decline(doctorId: string, callId: string): Promise<CallDto> {
    await this.expireStaleCalls();
    const call = await this.requireParticipant(doctorId, callId, 'doctor');
    await this.finish(call, ['RINGING'], 'DECLINED', { strict: true });
    return toCallDto(await this.reload(callId));
  }

  async cancel(patientId: string, callId: string): Promise<CallDto> {
    await this.expireStaleCalls();
    const call = await this.requireParticipant(patientId, callId, 'patient');
    await this.finish(call, ['RINGING'], 'CANCELED', { strict: true });
    return toCallDto(await this.reload(callId));
  }

  /**
   * Hangs up from either side. While the call is still ringing this cancels it (patient) or
   * declines it (doctor). Calling it on a call that is already over does nothing.
   */
  async end(userId: string, callId: string): Promise<CallDto> {
    await this.expireStaleCalls();
    const call = await this.requireParticipant(userId, callId);
    if (call.state === 'RINGING') {
      await this.finish(call, ['RINGING'], call.patientId === userId ? 'CANCELED' : 'DECLINED');
    } else if (call.state === 'ACCEPTED') {
      await this.finish(call, ['ACCEPTED'], 'ENDED');
    }
    return toCallDto(await this.reload(callId));
  }

  // --- helpers ---

  /** Moves a call to a new state only if it is still in one of `from`, so concurrent requests can't both win. */
  private async transition(
    call: Call,
    from: CallState[],
    to: CallState,
    data: Prisma.CallUpdateManyMutationInput = {},
  ): Promise<void> {
    const { count } = await this.prisma.call.updateMany({
      where: { id: call.id, state: { in: from } },
      data: { ...data, state: to },
    });
    if (count === 0) {
      const current = await this.reload(call.id);
      throw new ConflictException({
        code: 'CALL_STATE_CONFLICT',
        message: `The call is ${current.state.toLowerCase()}`,
        state: current.state,
      });
    }
  }

  /**
   * Ends a call: records the final state and closes the LiveKit room, which disconnects both phones.
   * A doctor's phone that is still ringing notices the new state itself (or stops at its ring timeout).
   */
  private async finish(
    call: Call,
    from: CallState[],
    to: CallState,
    { strict = false }: { strict?: boolean } = {},
  ): Promise<void> {
    try {
      await this.transition(call, from, to, { endedAt: new Date() });
    } catch (error) {
      if (strict) throw error;
      return; // Someone else already ended it.
    }
    void this.livekit.deleteRoom(roomName(call.id));
  }

  /** Marks calls nobody answered in time, and calls left open for too long, as over. */
  private async expireStaleCalls(): Promise<void> {
    const now = Date.now();
    const stale = await this.prisma.call.findMany({
      where: {
        OR: [
          { state: 'RINGING', createdAt: { lt: new Date(now - this.ringSeconds * 1000) } },
          { state: 'ACCEPTED', createdAt: { lt: new Date(now - MAX_CALL_MS) } },
        ],
      },
    });
    for (const call of stale) {
      await this.finish(call, [call.state], call.state === 'RINGING' ? 'UNANSWERED' : 'ENDED');
    }
  }

  /**
   * A doctor with no ringing or ongoing call, preferring doctors with a phone that can ring.
   * A call the patient cancelled can keep ringing on a closed app until the phone's own ring
   * timeout, and the phone drops a new ring meanwhile, so that doctor isn't free yet either.
   */
  private async findFreeDoctor(): Promise<User | null> {
    const mayStillRing = new Date(Date.now() - this.ringSeconds * 1000);
    const free: Prisma.UserWhereInput = {
      role: 'DOCTOR',
      doctorCalls: {
        none: {
          OR: [{ state: { in: ACTIVE_STATES } }, { state: 'CANCELED', createdAt: { gt: mayStillRing } }],
        },
      },
    };
    return (
      (await this.prisma.user.findFirst({ where: { ...free, devices: { some: {} } }, orderBy: { createdAt: 'asc' } })) ??
      (await this.prisma.user.findFirst({ where: free, orderBy: { createdAt: 'asc' } }))
    );
  }

  /**
   * A token for this call's room only, so the doctor can't join before accepting. Only the user's
   * id goes to LiveKit; the apps take names from the API.
   */
  private joinInfo(callId: string, user: User): Promise<CallJoinDto> {
    return this.livekit.createJoin(roomName(callId), user.id);
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** Loads a call the user takes part in (optionally as a given side); anything else is a 404. */
  private async requireParticipant(
    userId: string,
    callId: string,
    side?: 'patient' | 'doctor',
  ): Promise<CallWithParties> {
    const call = await this.prisma.call.findUnique({ where: { id: callId }, include: withParties });
    const isPatient = call?.patientId === userId;
    const isDoctor = call?.doctorId === userId;
    const allowed = side === 'patient' ? isPatient : side === 'doctor' ? isDoctor : isPatient || isDoctor;
    if (!call || !allowed) {
      throw new NotFoundException('Call not found');
    }
    return call;
  }

  private reload(callId: string): Promise<CallWithParties> {
    return this.prisma.call.findUniqueOrThrow({ where: { id: callId }, include: withParties });
  }
}

function toCallDto(call: CallWithParties): CallDto {
  return {
    id: call.id,
    state: call.state,
    media: call.media,
    patient: { id: call.patient.id, name: fullName(call.patient) },
    doctor: { id: call.doctor.id, name: fullName(call.doctor) },
    createdAt: call.createdAt,
    answeredAt: call.answeredAt,
    endedAt: call.endedAt,
  };
}

function fullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

/** Each call gets its own LiveKit room. LiveKit creates it when the patient joins. */
function roomName(callId: string): string {
  return `call-${callId}`;
}
