import { router } from 'expo-router';
import { CallHistoryList } from '@/components/CallHistoryList';
import { Header, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';

export default function DoctorCalls() {
  const { t } = useI18n();
  return (
    <Screen scroll={false} header={<Header large title={t('tabs.calls')} />}>
      <CallHistoryList viewer="DOCTOR" onOpen={(id) => router.push({ pathname: '/calls/[id]', params: { id } })} />
    </Screen>
  );
}
