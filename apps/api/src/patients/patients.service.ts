import { Injectable } from '@nestjs/common';
import { avatarUrl, fullName } from '../common/people';
import { CareService } from '../care/care.service';
import type { PatientBlock, Prisma, Subscription, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { BlockPatientDto, PatientDto } from './patient.dto';

type PatientRecord = User & {
  _count: { patientFolders: number };
  blocks: PatientBlock[];
  subscriptions: Subscription[];
};

/** Doctors: their patients, and the temporary block that stops one from calling. */
@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly care: CareService,
  ) {}

  /** Each word of `query` must match the name, email, phone or personal ID. */
  async list(doctorId: string, query?: string): Promise<PatientDto[]> {
    await this.users.requireRole(doctorId, 'DOCTOR');
    const words = (query ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
    const search: Prisma.UserWhereInput[] = words.map((word) => ({
      OR: (['firstName', 'lastName', 'email', 'phone', 'personalId'] as const).map((field) => ({
        [field]: { contains: word, mode: 'insensitive' },
      })),
    }));
    const patients = await this.prisma.user.findMany({
      where: { AND: [this.care.patientsOf(doctorId), ...search] },
      include: this.include(),
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 100,
    });
    return patients.map(toPatientDto);
  }

  async get(doctorId: string, patientId: string): Promise<PatientDto> {
    await this.users.requireRole(doctorId, 'DOCTOR');
    await this.care.requirePatientOf(doctorId, patientId);
    const patient = await this.prisma.user.findUniqueOrThrow({ where: { id: patientId }, include: this.include() });
    return toPatientDto(patient);
  }

  /** Replaces any block in force. Calls already under way go on. */
  async block(doctorId: string, patientId: string, dto: BlockPatientDto): Promise<PatientDto> {
    await this.users.requireRole(doctorId, 'DOCTOR');
    await this.care.requirePatientOf(doctorId, patientId);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.patientBlock.updateMany({
        where: { patientId, liftedAt: null, endsAt: { gt: now } },
        data: { liftedAt: now },
      }),
      this.prisma.patientBlock.create({
        data: { patientId, doctorId, reason: dto.reason, endsAt: new Date(now.getTime() + dto.durationHours * 3_600_000) },
      }),
    ]);
    return this.get(doctorId, patientId);
  }

  async unblock(doctorId: string, patientId: string): Promise<PatientDto> {
    await this.users.requireRole(doctorId, 'DOCTOR');
    await this.care.requirePatientOf(doctorId, patientId);
    const now = new Date();
    await this.prisma.patientBlock.updateMany({
      where: { patientId, liftedAt: null, endsAt: { gt: now } },
      data: { liftedAt: now },
    });
    return this.get(doctorId, patientId);
  }

  private include() {
    const now = new Date();
    return {
      _count: { select: { patientFolders: true } },
      blocks: { where: { liftedAt: null, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' }, take: 1 },
      subscriptions: {
        where: { startsAt: { lte: now }, endsAt: { gt: now } },
        orderBy: { endsAt: 'desc' },
        take: 1,
      },
    } satisfies Prisma.UserInclude;
  }
}

function toPatientDto(patient: PatientRecord): PatientDto {
  const block = patient.blocks[0];
  const plan = patient.subscriptions[0];
  return {
    id: patient.id,
    name: fullName(patient),
    avatarUrl: avatarUrl(patient),
    specialty: null,
    email: patient.email,
    phone: patient.phone,
    personalId: patient.personalId,
    sex: patient.sex,
    folderCount: patient._count.patientFolders,
    block: block ? { endsAt: block.endsAt, reason: block.reason } : null,
    plan: plan ? { planName: plan.planName, startsAt: plan.startsAt, endsAt: plan.endsAt } : null,
  };
}
