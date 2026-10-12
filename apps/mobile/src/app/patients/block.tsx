import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/errors';
import { queryKeys } from '@/api/queries';
import { patientsApi } from '@/api/records';
import { AppText, Button, ChipGroup, Header, Screen, TextField, useSnackbar } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

/** Block lengths offered, in hours. */
const DURATIONS = ['1', '24', '72', '168', '720'] as const;
type Duration = (typeof DURATIONS)[number];

/** Doctor: "Temporary block" stops a patient from calling for a while. */
export default function BlockPatientScreen() {
  const { id, name = '' } = useLocalSearchParams<{ id: string; name: string }>();
  const { t, tp } = useI18n();
  const queryClient = useQueryClient();
  const showSnackbar = useSnackbar();
  const [duration, setDuration] = useState<Duration>('24');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const block = useMutation({
    mutationFn: () => patientsApi.block(id, Number(duration), reason.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      showSnackbar({ message: t('block.done'), tone: 'success' });
      router.back();
    },
  });

  const label = (hours: Duration) => {
    const value = Number(hours);
    return value < 24 ? tp('block.hours', value) : tp('block.days', value / 24);
  };

  return (
    <Screen
      keyboard
      edges={['top', 'bottom']}
      header={<Header title={t('block.title')} back="close" />}
      footer={
        <Button
          label={t('block.submit')}
          icon="ban"
          variant="danger"
          loading={block.isPending}
          onPress={() => {
            setSubmitted(true);
            if (reason.trim()) block.mutate();
          }}
        />
      }
    >
      <View style={styles.intro}>
        <View style={styles.icon}>
          <Ionicons name="ban" size={30} color={colors.danger} />
        </View>
        <AppText variant="headline" align="center">
          {name}
        </AppText>
        <AppText variant="body" color={colors.textMuted} align="center">
          {t('block.intro')}
        </AppText>
      </View>
      <View style={styles.field}>
        <AppText variant="caption" weight="600" color={colors.textSecondary}>
          {t('block.duration')}
        </AppText>
        <ChipGroup<Duration> options={DURATIONS.map((value) => ({ value, label: label(value) }))} value={duration} onChange={setDuration} />
      </View>
      <TextField
        label={t('block.reason')}
        placeholder={t('block.reasonPlaceholder')}
        value={reason}
        onChangeText={setReason}
        multiline
        maxLength={500}
        error={submitted && !reason.trim() ? t('common.required') : undefined}
      />
      {block.isError ? (
        <AppText variant="caption" color={colors.danger} align="center">
          {errorMessage(block.error, t)}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    gap: spacing.sm,
  },
});
