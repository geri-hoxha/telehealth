import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { apiUrl } from '@/api/client';
import { useAppConfig, useSubscription } from '@/api/queries';
import { useAuth, useUser } from '@/auth/AuthProvider';
import { useI18n } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { colors, gradients, radius, shadows, spacing } from '@/theme';
import { AppText, Avatar, Badge, Button, Header, ListGroup, ListRow, Screen } from './ui';

/** The Profile tab of both roles; patients also get their health card and subscription. */
export function ProfileScreen() {
  const user = useUser();
  const { signOut } = useAuth();
  const { t, language } = useI18n();
  const isPatient = user.role === 'PATIENT';
  const subscription = useSubscription(isPatient);
  const config = useAppConfig();
  const active = subscription.data?.active ?? null;
  const name = `${user.firstName} ${user.lastName}`;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const callAssistance = () => {
    const phone = config.data?.supportPhone;
    if (!phone) {
      Alert.alert(t('profile.callAssistance'), t('profile.callAssistanceMissing'));
      return;
    }
    void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
  };

  const openPartners = () => {
    const url = config.data?.partnerNetworkUrl ?? '/api/pages/partners';
    const separator = url.includes('?') ? '&' : '?';
    router.push({
      pathname: '/web',
      params: { url: `${apiUrl(url)}${separator}lang=${language}`, title: t('profile.partnerNetwork') },
    });
  };

  const confirmLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen header={<Header large title={t('profile.title')} />}>
      <View style={styles.heroShadow}>
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroBubble} />
          <Avatar name={name} url={user.avatarUrl} size={76} ring />
          <View style={styles.heroText}>
            <AppText variant="headline" color={colors.white} numberOfLines={1}>
              {isPatient ? name : `${t('common.doctorPrefix')} ${name}`}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={1}>
              {user.email}
            </AppText>
            {isPatient ? (
              <Badge
                label={active ? t('profile.activeUntil', { date: formatDate(active.endsAt, language) }) : t('profile.noSubscription')}
                tone={active ? 'success' : 'warning'}
                icon={active ? 'shield-checkmark' : 'alert-circle'}
                style={styles.heroBadge}
              />
            ) : user.doctorProfile?.specialty ? (
              <Badge label={user.doctorProfile.specialty} tone="primary" icon="medkit" style={styles.heroBadge} />
            ) : null}
          </View>
        </LinearGradient>
      </View>
      <Button label={t('editProfile.title')} icon="create-outline" variant="outline" size="md" onPress={() => router.push('/profile/edit')} />

      <ListGroup title={t('profile.account')}>
        <ListRow icon="person-outline" title={t('profile.personalInfo')} onPress={() => router.push('/profile/edit')} />
        {isPatient ? <ListRow icon="card-outline" title={t('profile.healthCard')} onPress={() => router.push('/health-card')} /> : null}
        {isPatient ? (
          <ListRow
            icon="shield-checkmark-outline"
            title={t('profile.subscription')}
            value={active?.planName}
            onPress={() => router.push('/subscription')}
          />
        ) : null}
        <ListRow icon="key-outline" title={t('profile.changePassword')} onPress={() => router.push('/profile/password')} />
      </ListGroup>

      <ListGroup title={t('profile.help')}>
        <ListRow
          icon="headset-outline"
          iconColor={colors.success}
          iconBackground={colors.successSoft}
          title={t('profile.callAssistance')}
          onPress={callAssistance}
        />
        <ListRow
          icon="business-outline"
          iconColor={colors.info}
          iconBackground={colors.infoSoft}
          title={t('profile.partnerNetwork')}
          onPress={openPartners}
        />
      </ListGroup>

      <ListGroup title={t('profile.app')}>
        <ListRow icon="settings-outline" title={t('profile.settings')} onPress={() => router.push('/settings')} />
        <ListRow icon="information-circle-outline" title={t('profile.version', { version })} chevron={false} />
      </ListGroup>

      <ListGroup>
        <ListRow icon="log-out-outline" title={t('profile.logout')} destructive onPress={confirmLogout} chevron={false} />
      </ListGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroShadow: {
    borderRadius: radius.xl,
    ...shadows.raised,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg - 4,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  heroBubble: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -90,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  heroBadge: {
    marginTop: spacing.xs + 2,
  },
});
