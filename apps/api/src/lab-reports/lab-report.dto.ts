import { ApiProperty } from '@nestjs/swagger';
import { localize } from '../common/language';
import type { LabReport, LabResult } from '../generated/prisma/client';
import { LabReportType, type Language } from '../generated/prisma/enums';
import { LAB_STATUSES, labStatusOf, type LabRange, type LabStatus } from './lab-status';

export class LabRangeDto implements LabRange {
  @ApiProperty({ type: Number, nullable: true, example: 200, description: 'The range ends here and the next one starts; null: no end' })
  to: number | null;

  @ApiProperty({ enum: LAB_STATUSES })
  status: LabStatus;
}

export class LabResultDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Kolesteroli total' })
  name: string;

  @ApiProperty({ example: 'mg/dL', description: 'Empty when the value has no unit (pH)' })
  unit: string;

  @ApiProperty({ example: 195 })
  value: number;

  @ApiProperty({ example: 120, description: 'The scale drawn under the value starts here' })
  scaleMin: number;

  @ApiProperty({ example: 280 })
  scaleMax: number;

  @ApiProperty({ enum: LAB_STATUSES, description: 'The status of the range the value is in' })
  status: LabStatus;

  @ApiProperty({ type: LabRangeDto, isArray: true, description: 'In order, from the low end of the scale' })
  ranges: LabRangeDto[];
}

export class LabReportDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: LabReportType })
  type: LabReportType;

  @ApiProperty({ description: 'When the sample was taken' })
  takenAt: Date;

  @ApiProperty({ example: 'Laboratori Qendror, Tiranë' })
  lab: string;

  @ApiProperty({ type: LabResultDto, isArray: true })
  results: LabResultDto[];
}

export function toLabReportDto(report: LabReport & { results: LabResult[] }, language: Language): LabReportDto {
  return {
    id: report.id,
    type: report.type,
    takenAt: report.takenAt,
    lab: report.lab,
    results: report.results.map((result) => {
      const ranges = result.ranges as unknown as LabRange[];
      return {
        id: result.id,
        name: localize(result.name, language),
        unit: result.unit,
        value: result.value,
        scaleMin: result.scaleMin,
        scaleMax: result.scaleMax,
        status: labStatusOf(result.value, ranges),
        ranges,
      };
    }),
  };
}
