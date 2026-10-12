import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { mk } from './mk';
import { sq, type TranslationKey, type Translations } from './sq';

export type Language = 'sq' | 'en' | 'mk';
export type { TranslationKey };

export const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  { code: 'sq', name: 'Shqip', flag: '🇦🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'mk', name: 'Македонски', flag: '🇲🇰' },
];

const DICTIONARIES: Record<Language, Translations> = { sq, en, mk };
const STORAGE_KEY = 'app.language';

type Params = Record<string, string | number>;
/** Keys with `_one` / `_other` forms, without the suffix. */
export type PluralKey = TranslationKey extends infer K ? (K extends `${infer Base}_one` ? Base : never) : never;

export type Translate = (key: TranslationKey, params?: Params) => string;
export type TranslatePlural = (key: PluralKey, count: number, params?: Params) => string;

/** The language for code outside React (the API client's Accept-Language). */
let currentLanguage: Language = 'sq';
export const getLanguage = () => currentLanguage;

function fill(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Macedonian uses the singular for 1, 21, 31… but not 11; Albanian and English only for 1. */
function isOne(language: Language, count: number): boolean {
  return language === 'mk' ? count % 10 === 1 && count % 100 !== 11 : count === 1;
}

export function translate(language: Language, key: TranslationKey, params?: Params): string {
  return fill(DICTIONARIES[language][key] ?? sq[key] ?? key, params);
}

interface I18nContextValue {
  /** null until the user picks a language on first launch. */
  chosenLanguage: Language | null;
  language: Language;
  isLoading: boolean;
  setLanguage: (language: Language) => Promise<void>;
  t: Translate;
  tp: TranslatePlural;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [chosenLanguage, setChosenLanguage] = useState<Language | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'sq' || stored === 'en' || stored === 'mk') setChosenLanguage(stored);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const language = chosenLanguage ?? 'sq';
  currentLanguage = language;

  const setLanguage = useCallback(async (next: Language) => {
    currentLanguage = next;
    setChosenLanguage(next);
    await SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      chosenLanguage,
      language,
      isLoading,
      setLanguage,
      t: (key, params) => translate(language, key, params),
      tp: (key, count, params) =>
        translate(language, `${key}_${isOne(language, count) ? 'one' : 'other'}` as TranslationKey, { count, ...params }),
    }),
    [chosenLanguage, language, isLoading, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}
