import { registerGlobals } from '@livekit/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { linkAudioEngineToCallKit } from '@/calls/audio-engine';
import { CallCoordinator } from '@/calls/CallCoordinator';
import { ActionSheetProvider, SnackbarProvider } from '@/components/ui';
import { I18nProvider, useI18n } from '@/i18n';
import { NotificationCenter } from '@/notifications/NotificationCenter';
import { colors } from '@/theme';

// WebRTC for LiveKit. The phone's call screen (expo-callkit-telecom) owns the audio session.
registerGlobals({ autoConfigureAudioSession: false });
linkAudioEngineToCallKit();

// Keep the splash screen up until we know the language and whether a saved session exists.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <SnackbarProvider>
            <ActionSheetProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </ActionSheetProvider>
          </SnackbarProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

/**
 * One app for both roles. `index` sends each user where they belong (language picker, login,
 * patient or doctor tabs); the guards drop screens a user may not see.
 */
function RootNavigator() {
  const { isLoading: authLoading, user } = useAuth();
  const { isLoading: languageLoading, chosenLanguage } = useI18n();
  const isLoading = authLoading || languageLoading;

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  const isPatient = user?.role === 'PATIENT';
  const isDoctor = user?.role === 'DOCTOR';

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!chosenLanguage}>
          <Stack.Screen name="language" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!!chosenLanguage && !user}>
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack.Protected>

        <Stack.Protected guard={isPatient}>
          <Stack.Screen name="patient" options={{ animation: 'fade' }} />
          <Stack.Screen name="stories" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="subscription" />
          <Stack.Screen name="health-card" />
          <Stack.Screen name="lab-results" />
          <Stack.Screen name="events/[id]" />
          <Stack.Screen name="benefits/[id]" />
          <Stack.Screen name="articles/[id]" />
          <Stack.Screen name="doctors/[id]" />
        </Stack.Protected>

        <Stack.Protected guard={isDoctor}>
          <Stack.Screen name="doctor" options={{ animation: 'fade' }} />
          <Stack.Screen name="patients/[id]" />
          <Stack.Screen name="patients/block" options={{ presentation: 'modal' }} />
          <Stack.Screen name="folders/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="incoming" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="add-doctor" options={{ presentation: 'modal' }} />
        </Stack.Protected>

        <Stack.Protected guard={!!user}>
          <Stack.Screen name="call" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="calls/index" />
          <Stack.Screen name="calls/[id]" />
          <Stack.Screen name="folders/[id]" />
          <Stack.Screen name="profile/edit" />
          <Stack.Screen name="profile/password" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="web" options={{ presentation: 'modal' }} />
          <Stack.Screen name="document" options={{ presentation: 'fullScreenModal' }} />
        </Stack.Protected>
      </Stack>
      <CallCoordinator />
      <NotificationCenter />
    </>
  );
}
