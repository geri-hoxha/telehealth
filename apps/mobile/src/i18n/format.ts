import type { Language, Translate } from './index';

// Dates are formatted by hand: Hermes' Intl data for Albanian and Macedonian differs between
// iOS and Android, and these formats are short and fixed.

const MONTHS: Record<Language, string[]> = {
  sq: ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  mk: ['јан', 'фев', 'мар', 'апр', 'мај', 'јун', 'јул', 'авг', 'сеп', 'окт', 'ное', 'дек'],
};

const WEEKDAYS: Record<Language, string[]> = {
  sq: ['Die', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  mk: ['Нед', 'Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб'],
};

const pad = (value: number) => String(value).padStart(2, '0');
const toDate = (value: Date | string) => (typeof value === 'string' ? new Date(value) : value);

/** 8 Tet 2026 */
export function formatDate(value: Date | string, language: Language): string {
  const date = toDate(value);
  return `${date.getDate()} ${MONTHS[language][date.getMonth()]} ${date.getFullYear()}`;
}

/** 8 Tet */
export function formatDayMonth(value: Date | string, language: Language): string {
  const date = toDate(value);
  return `${date.getDate()} ${MONTHS[language][date.getMonth()]}`;
}

/** The month's short name, for date badges. */
export function monthShort(value: Date | string, language: Language): string {
  return MONTHS[language][toDate(value).getMonth()];
}

export function weekdayShort(value: Date | string, language: Language): string {
  return WEEKDAYS[language][toDate(value).getDay()];
}

/** 14:30 */
export function formatTime(value: Date | string): string {
  const date = toDate(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 8 Tet 2026, 14:30 */
export function formatDateTime(value: Date | string, language: Language): string {
  return `${formatDate(value, language)}, ${formatTime(value)}`;
}

/** 08.10.2026, for documents and emails. */
export function formatNumericDate(value: Date | string): string {
  const date = toDate(value);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** 12/27, as on a bank card. */
export function formatCardExpiry(value: Date | string): string {
  const date = toDate(value);
  return `${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(2)}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday, 14:30" or a date. */
export function formatRelative(value: Date | string, language: Language, t: Translate): string {
  const date = toDate(value);
  const now = new Date();
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  if (isSameDay(date, now)) return t('time.hoursAgo', { count: Math.floor(minutes / 60) });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `${t('common.yesterday')}, ${formatTime(date)}`;
  return formatDate(date, language);
}

/** "Today, 14:30", "Yesterday, 09:10" or "8 Tet 2026, 14:30". */
export function formatDayAndTime(value: Date | string, language: Language, t: Translate): string {
  const date = toDate(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, now)) return `${t('common.today')}, ${formatTime(date)}`;
  if (isSameDay(date, yesterday)) return `${t('common.yesterday')}, ${formatTime(date)}`;
  return formatDateTime(date, language);
}

/** 4 min 12 s */
export function formatDuration(totalSeconds: number, t: Translate): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0
    ? t('duration.minutesSeconds', { minutes, seconds: seconds % 60 })
    : t('duration.seconds', { seconds });
}

/** 4:05, for a running call. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = pad(seconds % 60);
  return hours > 0 ? `${hours}:${pad(minutes)}:${rest}` : `${minutes}:${rest}`;
}

/** 12 000 ALL (a decimal string from the API; whole amounts drop the decimals). */
export function formatMoney(amount: string, currency: string): string {
  const [whole, fraction] = amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decimals = fraction && Number(fraction) !== 0 ? `,${fraction}` : '';
  return `${grouped}${decimals} ${currency}`;
}

/** 4021 8830 1123 0042 */
export function formatCardNumber(value: string): string {
  return value.replace(/(.{4})(?=.)/g, '$1 ');
}
