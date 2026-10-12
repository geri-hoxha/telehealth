import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/api/errors';
import { queryKeys, useFolders, usePatient } from '@/api/queries';
import { patientsApi } from '@/api/records';
import type { Patient } from '@/api/types';
import { FolderCard } from '@/components/rows';
import {
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  InfoItem,
  ListSkeleton,
  LoadingState,
  Screen,
  SectionHeader,
  useSnackbar,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { formatDate, formatDateTime } from '@/i18n/format';
import { colors, gradients, radius, shadows, spacing } from '@/theme';

/** Doctor: one patient's details, medical folders, a + to write a new one, and a temporary block. */
export default function PatientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const patient = usePatient(id);
  const folders = useFolders(id);

  return (
    <View style={styles.flex}>
      <Screen
        header={<Header title={t('patient.title')} />}
        onRefresh={() => {
          void patient.refetch();
          void folders.refetch();
        }}
        refreshing={patient.isRefetching}
        contentStyle={styles.content}
      >
        {patient.isPending ? (
          <LoadingState />
        ) : patient.isError ? (
          <ErrorState error={patient.error} onRetry={() => void patient.refetch()} />
        ) : (
          <>
            <PatientCard patient={patient.data} />
            <BlockCard patient={patient.data} />
            <SectionHeader title={t('patient.folders')} />
            {folders.isPending ? (
              <ListSkeleton count={2} height={150} />
            ) : folders.data?.length ? (
              <View style={styles.list}>
                {folders.data.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onPress={() => router.push({ pathname: '/folders/[id]', params: { id: folder.id } })}
                  />
                ))}
              </View>
            ) : (
              <EmptyState icon="folder-open-outline" text={t('patient.foldersEmpty')} />
            )}
          </>
        )}
      </Screen>
      {patient.data ? (
        <Pressable
          onPress={() =>
            router.push({ pathname: '/folders/new', params: { patientId: id, patientName: patient.data.name } })
          }
          accessibilityRole="button"
          accessibilityLabel={t('patient.newFolder')}
          style={({ pressed }) => [styles.fabShadow, { bottom: insets.bottom + spacing.lg }, pressed && styles.pressed]}
        >
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <Ionicons name="add" size={30} color={colors.white} />
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

function PatientCard({ patient }: { patient: Patient }) {
  const { t, language } = useI18n();
  return (
    <Card style={styles.patient}>
      <View style={styles.patientTop}>
        <Avatar name={patient.name} url={patient.avatarUrl} size={64} />
        <View style={styles.flex}>
          <AppText variant="headline">{patient.name}</AppText>
          {patient.sex ? (
            <AppText variant="caption" color={colors.textMuted}>
              {t(`sex.${patient.sex}`)}
            </AppText>
          ) : null}
          <Badge
            label={patient.plan ? `${patient.plan.planName} · ${formatDate(patient.plan.endsAt, language)}` : t('patient.noPlan')}
            tone={patient.plan ? 'success' : 'warning'}
            icon={patient.plan ? 'shield-checkmark' : 'alert-circle'}
            style={styles.planBadge}
          />
        </View>
      </View>
      <View style={styles.infos}>
        <Pressable
          onPress={() => (patient.phone ? void Linking.openURL(`tel:${patient.phone.replace(/[^\d+]/g, '')}`) : undefined)}
          accessibilityRole={patient.phone ? 'button' : undefined}
        >
          <InfoItem icon="call" label={t('patient.phone')} value={patient.phone ?? t('common.noData')} />
        </Pressable>
        <Pressable onPress={() => void Linking.openURL(`mailto:${patient.email}`)} accessibilityRole="button">
          <InfoItem icon="mail" label={t('patient.email')} value={patient.email} />
        </Pressable>
        <InfoItem icon="card" label={t('patient.personalId')} value={patient.personalId ?? t('common.noData')} />
      </View>
    </Card>
  );
}

function BlockCard({ patient }: { patient: Patient }) {
  const { t, language } = useI18n();
  const queryClient = useQueryClient();
  const showSnackbar = useSnackbar();
  const unblock = useMutation({
    mutationFn: () => patientsApi.unblock(patient.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.patients }),
    onError: (error) => showSnackbar({ message: errorMessage(error, t), tone: 'error' }),
  });

  if (!patient.block) {
    return (
      <Button
        label={t('patient.block')}
        icon="ban"
        variant="dangerSoft"
        size="md"
        onPress={() => router.push({ pathname: '/patients/block', params: { id: patient.id, name: patient.name } })}
      />
    );
  }
  return (
    <Card style={styles.blocked}>
      <View style={styles.blockedRow}>
        <View style={styles.blockedIcon}>
          <Ionicons name="ban" size={20} color={colors.danger} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color={colors.danger}>
            {t('patient.blockedUntil', { date: formatDateTime(patient.block.endsAt, language) })}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {patient.block.reason}
          </AppText>
        </View>
      </View>
      <Button
        label={t('patient.unblock')}
        variant="outline"
        size="md"
        loading={unblock.isPending}
        onPress={() =>
          Alert.alert(t('patient.unblock'), t('patient.unblockConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('patient.unblock'), onPress: () => unblock.mutate() },
          ])
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  patient: {
    gap: spacing.md,
  },
  patientTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planBadge: {
    marginTop: spacing.xs + 2,
  },
  infos: {
    gap: spacing.md - 4,
    paddingTop: spacing.md - 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  blocked: {
    gap: spacing.md - 4,
    backgroundColor: '#FFF5F6',
    borderWidth: 1,
    borderColor: colors.dangerSoft,
  },
  blockedRow: {
    flexDirection: 'row',
    gap: spacing.md - 4,
    alignItems: 'center',
  },
  blockedIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: spacing.md - 4,
  },
  fabShadow: {
    position: 'absolute',
    right: spacing.lg,
    borderRadius: 30,
    ...shadows.raised,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
});
