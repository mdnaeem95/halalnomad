import { useColorScheme } from 'react-native';
import { useAppStore } from '../stores/app-store';
import { AppColors, getColors, getHalalLevelColors, ColorScheme } from '../constants/theme';

interface ThemeState {
  colors: AppColors;
  halalLevelColors: Record<number, string>;
  isDark: boolean;
  scheme: 'light' | 'dark';
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

export function useTheme(): ThemeState {
  const systemScheme = useColorScheme();
  const colorScheme = useAppStore((s) => s.colorScheme);
  const setColorScheme = useAppStore((s) => s.setColorScheme);

  const resolved: 'light' | 'dark' =
    colorScheme === 'system'
      ? (systemScheme ?? 'light')
      : colorScheme;

  return {
    colors: getColors(resolved),
    halalLevelColors: getHalalLevelColors(resolved),
    isDark: resolved === 'dark',
    scheme: resolved,
    colorScheme,
    setColorScheme,
  };
}
