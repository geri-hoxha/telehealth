export const LAB_STATUSES = ['LOW', 'NORMAL', 'BORDERLINE', 'HIGH'] as const;
export type LabStatus = (typeof LAB_STATUSES)[number];

/** A reference range. It runs up to `to`, where the next one starts (null: no end). */
export interface LabRange {
  to: number | null;
  status: LabStatus;
}

/** The status of the range a value is in. A value on a boundary belongs to the range above it. */
export function labStatusOf(value: number, ranges: LabRange[]): LabStatus {
  const range = ranges.find((candidate) => candidate.to === null || value < candidate.to) ?? ranges.at(-1);
  return range?.status ?? 'NORMAL';
}
