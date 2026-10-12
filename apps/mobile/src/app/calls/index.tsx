import { router } from 'expo-router';
import { useUser } from '@/auth/AuthProvider';
import { CallHistoryList } from '@/components/CallHistoryList';
import { Header, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';

/** "See all": the whole call history. */
export default function CallHistoryScreen() {
  const user = useUser();
  const { t } = useI18n();
  return (
    <Screen scroll={false} header={<Header title={t('calls.title')} />}>
      <CallHistoryList viewer={user.role} onOpen={(id) => router.push({ pathname: '/calls/[id]', params: { id } })} />
    </Screen>
  );
}
