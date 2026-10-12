import { Tabs } from 'expo-router';
import { CallTabButton, tabIcon, tabScreenOptions } from '@/components/TabBar';
import { useI18n } from '@/i18n';

/** Patient tabs: Home, Activities, Call (the big centre button), Medical folders, Profile. */
export default function PatientTabs() {
  const { t } = useI18n();
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen
        name="activities"
        options={{ title: t('tabs.activities'), tabBarIcon: tabIcon('calendar', 'calendar-outline') }}
      />
      <Tabs.Screen
        name="call"
        options={{
          title: t('tabs.call'),
          tabBarButton: (props) => (
            <CallTabButton onPress={props.onPress} accessibilityState={props.accessibilityState} label={t('tabs.call')} />
          ),
        }}
      />
      <Tabs.Screen
        name="folders"
        options={{ title: t('tabs.folders'), tabBarIcon: tabIcon('folder-open', 'folder-open-outline') }}
      />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('person', 'person-outline') }} />
    </Tabs>
  );
}
