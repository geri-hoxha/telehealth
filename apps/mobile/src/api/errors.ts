import type { Translate, TranslationKey } from '@/i18n';
import { sq } from '@/i18n/sq';
import { ApiError } from './client';

/** A message for an API error: its code's translation when there is one, else a general one. */
export function errorMessage(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return t('common.networkError');
    const key = `error.${error.code}`;
    if (error.code && key in sq) return t(key as TranslationKey);
  }
  return t('common.error');
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}
