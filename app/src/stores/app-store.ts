import { create } from 'zustand';
import i18n from '../i18n';
import { SupportedLanguage } from '../i18n';
import { configureRTL } from '../lib/rtl';
import { track, EVENTS } from '../lib/analytics';
import { ColorScheme } from '../constants/theme';
import { CuisineType, HalalLevel, MapProviderType, PriceRange } from '../types';

interface SearchFilters {
  cuisineType: CuisineType | null;
  minHalalLevel: HalalLevel | null;
  priceRange: PriceRange | null;
}

interface AppState {
  // Theme
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;

  // Language
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;

  // Map provider
  mapProvider: MapProviderType;
  setMapProvider: (provider: MapProviderType) => void;

  // View preferences
  exploreViewMode: 'map' | 'list' | 'browse';
  setExploreViewMode: (mode: 'map' | 'list' | 'browse') => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchFilters: SearchFilters;
  setSearchFilters: (filters: Partial<SearchFilters>) => void;
  resetSearchFilters: () => void;

  // Session (in-memory, per app-open). Powers is_first_view_of_session +
  // time_to_first_view_seconds on place_viewed. markSessionStarted is
  // called once per Application Opened from lib/session.ts.
  sessionStartedAt: number | null;
  sessionHadFirstView: boolean;
  markSessionStarted: () => void;
  consumePlaceView: () => { isFirstOfSession: boolean; secondsSinceStart: number | null };
}

const DEFAULT_FILTERS: SearchFilters = {
  cuisineType: null,
  minHalalLevel: null,
  priceRange: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  colorScheme: 'system' as ColorScheme,
  setColorScheme: (scheme) => set({ colorScheme: scheme }),

  language: (i18n.language as SupportedLanguage) || 'en',
  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    configureRTL(lang);
    track(EVENTS.LANGUAGE_CHANGED, { language: lang });
    set({ language: lang });
  },

  mapProvider: 'google',
  setMapProvider: (provider) => set({ mapProvider: provider }),

  exploreViewMode: 'map',
  setExploreViewMode: (mode) => set({ exploreViewMode: mode }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  searchFilters: DEFAULT_FILTERS,
  setSearchFilters: (filters) =>
    set((state) => ({
      searchFilters: { ...state.searchFilters, ...filters },
    })),
  resetSearchFilters: () => set({ searchFilters: DEFAULT_FILTERS }),

  sessionStartedAt: null,
  sessionHadFirstView: false,
  markSessionStarted: () =>
    set({ sessionStartedAt: Date.now(), sessionHadFirstView: false }),
  consumePlaceView: () => {
    const { sessionStartedAt, sessionHadFirstView } = get();
    if (sessionHadFirstView) {
      return { isFirstOfSession: false, secondsSinceStart: null };
    }
    set({ sessionHadFirstView: true });
    const secondsSinceStart =
      sessionStartedAt != null
        ? Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000))
        : null;
    return { isFirstOfSession: true, secondsSinceStart };
  },
}));
