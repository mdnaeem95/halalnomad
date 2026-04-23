import { I18nManager } from 'react-native';
import { RTL_LANGUAGES, SupportedLanguage } from '../i18n';

/**
 * Configure RTL layout based on language.
 * Must be called when language changes.
 * Note: RN requires a restart to apply RTL changes — this is a platform limitation.
 */
export function configureRTL(language: SupportedLanguage) {
  const shouldBeRTL = RTL_LANGUAGES.includes(language);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.forceRTL(shouldBeRTL);
    I18nManager.allowRTL(shouldBeRTL);
    // App needs to restart for RTL to take effect
    // In production, prompt the user
  }
}
