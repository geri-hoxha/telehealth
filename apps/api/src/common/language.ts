import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Prisma } from '../generated/prisma/client';
import type { Language } from '../generated/prisma/enums';

const BY_CODE: Record<string, Language> = { sq: 'SQ', en: 'EN', mk: 'MK' };

/** The app sends its language as Accept-Language: "sq", "en" or "mk". */
export function languageFromHeader(header: string | undefined): Language | undefined {
  const code = header?.split(',')[0]?.trim().slice(0, 2).toLowerCase();
  return code ? BY_CODE[code] : undefined;
}

/** The language of the request, Albanian when the app didn't say. */
export const RequestLanguage = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Language =>
    languageFromHeader(context.switchToHttp().getRequest<Request>().headers['accept-language']) ?? 'SQ',
);

/** Content texts are stored as {"sq": …, "en": …, "mk": …}; missing ones fall back to Albanian. */
export function localize(value: Prisma.JsonValue | null | undefined, language: Language): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const texts = value as Record<string, unknown>;
  const text = texts[language.toLowerCase()] ?? texts['sq'] ?? texts['en'] ?? Object.values(texts)[0];
  return typeof text === 'string' ? text : '';
}

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Tirane',
});

/** 08.10.2026, the format used in Albania and North Macedonia. */
export function formatDate(date: Date): string {
  return DATE_FORMAT.format(date);
}
