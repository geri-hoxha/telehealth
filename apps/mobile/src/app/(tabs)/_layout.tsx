import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(focusedIcon: IconName, icon: IconName) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? focusedIcon : icon} size={size} color={color} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Kryefaqja', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="doctor"
        options={{ title: 'Mjeku', tabBarIcon: tabIcon('medkit', 'medkit-outline') }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'Historiku', tabBarIcon: tabIcon('time', 'time-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profili', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tabs>
  );
}
