import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './locales/en';
import ar from './locales/ar';
import tr from './locales/tr';
import ms from './locales/ms';

const deviceLocale = getLocales()[0]?.languageCode ?? 'en';

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  ms: 'Bahasa Melayu',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// RTL languages
export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    tr: { translation: tr },
    ms: { translation: ms },
  },
  lng: deviceLocale in SUPPORTED_LANGUAGES ? deviceLocale : 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
