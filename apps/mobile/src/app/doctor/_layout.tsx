import { Tabs } from 'expo-router';
import { tabIcon, tabScreenOptions } from '@/components/TabBar';
import { useI18n } from '@/i18n';

/** Doctor tabs: Home, Calls, Patients, Profile. */
export default function DoctorTabs() {
  const { t } = useI18n();
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="calls" options={{ title: t('tabs.calls'), tabBarIcon: tabIcon('call', 'call-outline') }} />
      <Tabs.Screen name="patients" options={{ title: t('tabs.patients'), tabBarIcon: tabIcon('people', 'people-outline') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('person', 'person-outline') }} />
    </Tabs>
  );
}
