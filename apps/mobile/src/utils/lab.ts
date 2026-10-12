import type { LabRange, LabStatus } from '@/api/types';

/** The status of the range a value is in. A value on a boundary belongs to the range above it, as on the server. */
export function labStatusAt(value: number, ranges: LabRange[]): LabStatus {
  const range = ranges.find((candidate) => candidate.to === null || value < candidate.to) ?? ranges[ranges.length - 1];
  return range?.status ?? 'NORMAL';
}
