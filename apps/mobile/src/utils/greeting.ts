import { useI18n } from '@/i18n';

/** "Good morning / afternoon / evening" for the time of day. */
export function useGreeting(): string {
  const { t } = useI18n();
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return t('greeting.morning');
  if (hour >= 12 && hour < 18) return t('greeting.afternoon');
  return t('greeting.evening');
}
