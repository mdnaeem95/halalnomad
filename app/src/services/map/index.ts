import { MapProviderType } from '../../types';
import { MapProvider } from './types';
import { GoogleMapsProvider } from './google';

export { GoogleMapsProvider } from './google';
export type { MapProvider, MapSearchResult, MapAddress } from './types';

const providers: Record<string, MapProvider> = {
  google: GoogleMapsProvider,
  // Future: amap, baidu, yandex, naver
};

/**
 * Registry of map providers. Extensible — add new providers by
 * registering them here.
 */
export function getMapProvider(type: MapProviderType): MapProvider {
  return providers[type] ?? GoogleMapsProvider;
}

/**
 * Given a country code (ISO 3166-1 alpha-2), return the recommended
 * map provider. Defaults to Google Maps for most regions.
 */
export function getRecommendedProvider(countryCode: string): MapProviderType {
  switch (countryCode.toUpperCase()) {
    case 'CN':
      // AMap is more accurate in China; fall back to Google until AMap provider is implemented
      return 'google';
    // Future additions:
    // case 'RU': return 'yandex';
    // case 'KR': return 'naver';
    default:
      return 'google';
  }
}
