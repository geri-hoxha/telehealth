import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Which patients a doctor may see: those they talked to in a call (answered it or were added to
 * it) or wrote a medical folder for.
 */
@Injectable()
export class CareService {
  constructor(private readonly prisma: PrismaService) {}

  patientsOf(doctorId: string): Prisma.UserWhereInput {
    return {
      role: 'PATIENT',
      OR: [
        { patientCalls: { some: { doctorId, answeredAt: { not: null } } } },
        { patientCalls: { some: { invites: { some: { doctorId, state: { in: ['ACCEPTED', 'LEFT'] } } } } } },
        { patientFolders: { some: { doctorId } } },
      ],
    };
  }

  async isPatientOf(doctorId: string, patientId: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { id: patientId, ...this.patientsOf(doctorId) } });
    return count > 0;
  }

  /** A patient the doctor doesn't treat is a 404, as if they didn't exist. */
  async requirePatientOf(doctorId: string, patientId: string): Promise<void> {
    if (!(await this.isPatientOf(doctorId, patientId))) {
      throw new NotFoundException('Patient not found');
    }
  }
}
