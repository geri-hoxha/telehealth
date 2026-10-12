import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useDoctor } from '@/api/queries';
import type { Doctor } from '@/api/types';
import { AppText, Avatar, Badge, Card, ErrorState, Header, InfoItem, LoadingState, Screen, SectionHeader } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, gradients, radius, spacing } from '@/theme';

/** A doctor's public profile, opened from a call's details. */
export default function DoctorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const doctor = useDoctor(id);

  return (
    <Screen header={<Header title={t('doctorProfile.title')} />}>
      {doctor.isPending ? (
        <LoadingState />
      ) : doctor.isError ? (
        <ErrorState error={doctor.error} onRetry={() => void doctor.refetch()} />
      ) : (
        <DoctorDetails doctor={doctor.data} />
      )}
    </Screen>
  );
}

function DoctorDetails({ doctor }: { doctor: Doctor }) {
  const { t } = useI18n();
  return (
    <>
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Avatar name={doctor.name} url={doctor.avatarUrl} size={96} ring />
        <AppText variant="title" color={colors.white} align="center">
          {t('common.doctorPrefix')} {doctor.name}
        </AppText>
        {doctor.specialty ? <Badge label={doctor.specialty} icon="medkit" tone="primary" /> : null}
        <View style={styles.stat}>
          <AppText variant="headline" color={colors.white}>
            {doctor.callCount}
          </AppText>
          <AppText variant="small" color="rgba(255,255,255,0.85)">
            {t('doctorProfile.calls')}
          </AppText>
        </View>
      </LinearGradient>

      {doctor.bio ? (
        <>
          <SectionHeader title={t('doctorProfile.about')} />
          <Card>
            <AppText variant="body" color={colors.textSecondary}>
              {doctor.bio}
            </AppText>
          </Card>
        </>
      ) : null}

      <Card style={styles.info}>
        <InfoItem icon="business" label={t('doctorProfile.healthCentre')} value={doctor.healthCentre ?? t('common.noData')} />
        <InfoItem icon="location" label={t('doctorProfile.city')} value={doctor.city ?? t('common.noData')} />
        <InfoItem icon="flag" label={t('doctorProfile.country')} value={doctor.country ?? t('common.noData')} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
  },
  stat: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  info: {
    gap: spacing.md,
  },
});
