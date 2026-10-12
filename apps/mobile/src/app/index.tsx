import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { useI18n } from '@/i18n';

/** Sends everyone to their start: the language picker, login, or their role's tabs. */
export default function Index() {
  const { user } = useAuth();
  const { chosenLanguage } = useI18n();

  if (!chosenLanguage) return <Redirect href="/language" />;
  if (!user) return <Redirect href="/welcome" />;
  return <Redirect href={user.role === 'DOCTOR' ? '/doctor' : '/patient'} />;
}
