import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/queries';
import { foldersApi } from '@/api/records';
import { CONCERN_CATEGORIES, type ConcernCategory } from '@/api/types';
import { AppText, Button, Card, ChipGroup, Header, Screen, TextField, useSnackbar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, weekdayShort } from '@/i18n/format';
import { colors, radius, spacing } from '@/theme';

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in local time, as the API expects the visit date. */
function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Doctor: a new visit record for a patient. The patient gets a notification. */
export default function NewFolderScreen() {
  const { patientId, patientName = '' } = useLocalSearchParams<{ patientId: string; patientName: string }>();
  const { t, language } = useI18n();
  const queryClient = useQueryClient();
  const showSnackbar = useSnackbar();
  const [visitDate, setVisitDate] = useState(() => new Date());
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [medicalComments, setMedicalComments] = useState('');
  const [category, setCategory] = useState<ConcernCategory>('GENERAL');
  const [submitted, setSubmitted] = useState(false);

  const isToday = isoDay(visitDate) === isoDay(new Date());

  const create = useMutation({
    mutationFn: () =>
      foldersApi.create({
        patientId,
        visitDate: isoDay(visitDate),
        symptoms: symptoms.trim(),
        diagnosis: diagnosis.trim(),
        prescription: prescription.trim() || undefined,
        recommendations: recommendations.trim() || undefined,
        medicalComments: medicalComments.trim() || undefined,
        concernCategory: category,
      }),
    onSuccess: (folder) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.folders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      showSnackbar({ message: t('newFolder.saved'), tone: 'success' });
      router.dismiss();
      router.push({ pathname: '/folders/[id]', params: { id: folder.id } });
    },
  });

  const submit = () => {
    setSubmitted(true);
    if (symptoms.trim() && diagnosis.trim()) create.mutate();
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<Header title={t('newFolder.title')} back="close" />}
      footer={<Button label={t('newFolder.save')} icon="checkmark" onPress={submit} loading={create.isPending} />}
    >
      <AppText variant="caption" color={colors.textMuted} align="center">
        {t('newFolder.for', { name: patientName })}
      </AppText>

      <Card style={styles.dateCard}>
        <AppText variant="caption" weight="600" color={colors.textSecondary}>
          {t('folder.visitDate')}
        </AppText>
        <View style={styles.dateRow}>
          <Pressable
            onPress={() => setVisitDate(new Date(visitDate.getTime() - DAY_MS))}
            accessibilityRole="button"
            accessibilityLabel="−1"
            style={styles.dateButton}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </Pressable>
          <View style={styles.dateValue}>
            <AppText variant="headline">{formatDate(visitDate, language)}</AppText>
            <AppText variant="small" color={colors.textMuted}>
              {isToday ? t('common.today') : weekdayShort(visitDate, language)}
            </AppText>
          </View>
          <Pressable
            onPress={() => setVisitDate(new Date(visitDate.getTime() + DAY_MS))}
            disabled={isToday}
            accessibilityRole="button"
            accessibilityLabel="+1"
            style={[styles.dateButton, isToday && styles.disabled]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </Pressable>
        </View>
      </Card>

      <TextField
        label={t('folder.symptoms')}
        placeholder={t('newFolder.symptomsPlaceholder')}
        value={symptoms}
        onChangeText={setSymptoms}
        multiline
        error={submitted && !symptoms.trim() ? t('common.required') : undefined}
      />
      <TextField
        label={t('folder.diagnosis')}
        placeholder={t('newFolder.diagnosisPlaceholder')}
        value={diagnosis}
        onChangeText={setDiagnosis}
        error={submitted && !diagnosis.trim() ? t('common.required') : undefined}
      />
      <TextField
        label={`${t('folder.prescription')} (${t('common.optional')})`}
        placeholder={t('newFolder.prescriptionPlaceholder')}
        value={prescription}
        onChangeText={setPrescription}
        multiline
      />
      <TextField
        label={`${t('folder.recommendations')} (${t('common.optional')})`}
        placeholder={t('newFolder.recommendationsPlaceholder')}
        value={recommendations}
        onChangeText={setRecommendations}
        multiline
      />
      <TextField
        label={`${t('folder.medicalComments')} (${t('common.optional')})`}
        placeholder={t('newFolder.medicalCommentsPlaceholder')}
        hint={t('folder.medicalCommentsHint')}
        icon="lock-closed-outline"
        value={medicalComments}
        onChangeText={setMedicalComments}
        multiline
      />

      <View style={styles.categories}>
        <AppText variant="caption" weight="600" color={colors.textSecondary}>
          {t('folder.category')}
        </AppText>
        <ChipGroup<ConcernCategory>
          options={CONCERN_CATEGORIES.map((value) => ({ value, label: t(`concern.${value}`) }))}
          value={category}
          onChange={setCategory}
        />
      </View>

      {create.isError ? (
        <AppText variant="caption" color={colors.danger} align="center">
          {errorMessage(create.error, t)}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateCard: {
    gap: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
  },
  dateButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateValue: {
    flex: 1,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  categories: {
    gap: spacing.sm,
  },
});
