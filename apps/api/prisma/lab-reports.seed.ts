import type { PrismaClient } from '../src/generated/prisma/client';
import type { LabStatus } from '../src/lab-reports/lab-status';

const DAY = 24 * 60 * 60 * 1000;
/** A text in the app's three languages. */
const t = (sq: string, en: string, mk: string) => ({ sq, en, mk });

/** Where each range ends (null: no end) and its status. */
type Range = [to: number | null, status: LabStatus];

/** One measurement; the ranges are the lab's reference ranges, from the low end of the scale. */
function result(position: number, name: ReturnType<typeof t>, unit: string, value: number, scale: [min: number, max: number], ranges: Range[]) {
  return {
    position,
    name,
    unit,
    value,
    scaleMin: scale[0],
    scaleMax: scale[1],
    ranges: ranges.map(([to, status]) => ({ to, status })),
  };
}

/** Gives the patient a blood test and a urine test from a few days ago, replacing any they had. */
export async function seedLabReports(prisma: PrismaClient, patientId: string, now = Date.now()) {
  await prisma.labReport.deleteMany({ where: { patientId } });
  const takenAt = new Date(now - 5 * DAY);
  const lab = 'Laboratori Intermedica, Tiranë';

  await prisma.labReport.create({
    data: {
      patientId, type: 'BLOOD', takenAt, lab,
      results: {
        create: [
          result(1, t('Hemoglobina', 'Hemoglobin', 'Хемоглобин'), 'g/dL', 14.8, [10, 19], [[13.5, 'LOW'], [17.5, 'NORMAL'], [null, 'HIGH']]),
          result(2, t('Leukocitet', 'White blood cells', 'Леукоцити'), '×10³/µL', 6.8, [2, 14], [[4, 'LOW'], [10, 'NORMAL'], [12, 'BORDERLINE'], [null, 'HIGH']]),
          result(3, t('Trombocitet', 'Platelets', 'Тромбоцити'), '×10³/µL', 238, [100, 500], [[150, 'LOW'], [400, 'NORMAL'], [null, 'HIGH']]),
          result(4, t('Glukoza në gjak (esëll)', 'Fasting blood glucose', 'Глукоза во крв (на гладно)'), 'mg/dL', 104, [60, 140], [[70, 'LOW'], [100, 'NORMAL'], [126, 'BORDERLINE'], [null, 'HIGH']]),
          result(5, t('HbA1c (sheqeri mesatar)', 'HbA1c (average blood sugar)', 'HbA1c (просечен шеќер)'), '%', 5.4, [4, 8], [[5.7, 'NORMAL'], [6.5, 'BORDERLINE'], [null, 'HIGH']]),
          result(6, t('Kolesteroli total', 'Total cholesterol', 'Вкупен холестерол'), 'mg/dL', 214, [120, 280], [[200, 'NORMAL'], [240, 'BORDERLINE'], [null, 'HIGH']]),
          result(7, t('Kolesteroli LDL', 'LDL cholesterol', 'LDL холестерол'), 'mg/dL', 118, [40, 200], [[130, 'NORMAL'], [160, 'BORDERLINE'], [null, 'HIGH']]),
          result(8, t('Kolesteroli HDL', 'HDL cholesterol', 'HDL холестерол'), 'mg/dL', 52, [20, 100], [[40, 'LOW'], [null, 'NORMAL']]),
          result(9, t('Trigliceridet', 'Triglycerides', 'Триглицериди'), 'mg/dL', 98, [40, 300], [[150, 'NORMAL'], [200, 'BORDERLINE'], [null, 'HIGH']]),
          result(10, t('Vitamina D', 'Vitamin D', 'Витамин D'), 'ng/mL', 17, [0, 80], [[20, 'LOW'], [30, 'BORDERLINE'], [null, 'NORMAL']]),
        ],
      },
    },
  });

  await prisma.labReport.create({
    data: {
      patientId, type: 'URINE', takenAt, lab,
      results: {
        create: [
          result(1, t('pH', 'pH', 'pH'), '', 6, [4, 9], [[4.6, 'LOW'], [8, 'NORMAL'], [null, 'HIGH']]),
          result(2, t('Pesha specifike', 'Specific gravity', 'Специфична тежина'), '', 1.018, [1, 1.04], [[1.005, 'LOW'], [1.03, 'NORMAL'], [null, 'HIGH']]),
          result(3, t('Proteina', 'Protein', 'Протеини'), 'mg/dL', 8, [0, 60], [[15, 'NORMAL'], [30, 'BORDERLINE'], [null, 'HIGH']]),
          result(4, t('Glukoza', 'Glucose', 'Глукоза'), 'mg/dL', 0, [0, 60], [[15, 'NORMAL'], [null, 'HIGH']]),
          result(5, t('Leukocitet', 'White blood cells', 'Леукоцити'), '/hpf', 12, [0, 24], [[5, 'NORMAL'], [10, 'BORDERLINE'], [null, 'HIGH']]),
          result(6, t('Eritrocitet', 'Red blood cells', 'Еритроцити'), '/hpf', 1, [0, 12], [[3, 'NORMAL'], [5, 'BORDERLINE'], [null, 'HIGH']]),
        ],
      },
    },
  });
}
