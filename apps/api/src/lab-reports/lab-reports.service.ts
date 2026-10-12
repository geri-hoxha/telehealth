import { Injectable } from '@nestjs/common';
import { LabReportType, type Language } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { toLabReportDto, type LabReportDto } from './lab-report.dto';

/** A patient's lab results (blood and urine tests). They come from the labs; patients only read them. */
@Injectable()
export class LabReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /** The latest blood test and the latest urine test, newest first. */
  async latest(userId: string, language: Language): Promise<LabReportDto[]> {
    await this.users.requireRole(userId, 'PATIENT');
    const reports = await Promise.all(
      Object.values(LabReportType).map((type) =>
        this.prisma.labReport.findFirst({
          where: { patientId: userId, type },
          orderBy: { takenAt: 'desc' },
          include: { results: { orderBy: { position: 'asc' } } },
        }),
      ),
    );
    return reports
      .filter((report) => report !== null)
      .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())
      .map((report) => toLabReportDto(report, language));
  }
}
