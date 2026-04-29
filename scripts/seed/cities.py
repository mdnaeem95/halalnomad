"""Curated district centroids per priority city.

Each city is a list of (district_name, lat, lng) tuples. We sweep Google
Places `nearbysearch` from each centroid with a fixed radius — this gives
denser coverage than a single citywide text search (which caps at 60
results per query).

Coords are approximate centroids of well-known districts; precision to 4
decimals (~10 m) is fine since we use ~2.5 km radius around each.

When adding a city: aim for districts likely to have halal options
(near mosques, foreign-tourist areas, immigrant neighbourhoods,
universities). 8-15 districts is typical.
"""

from typing import NamedTuple


class District(NamedTuple):
    name: str
    lat: float
    lng: float


# Default radius (metres) for nearby search around each district centroid.
DEFAULT_RADIUS_M = 2500


# Tier-1 priority cities (see planning/data-sourcing-strategy.md)

TOKYO = [
    District("Shinjuku", 35.6938, 139.7036),
    District("Shibuya", 35.6580, 139.7016),
    District("Asakusa", 35.7148, 139.7967),     # near Asakusa Mosque
    District("Otsuka", 35.7311, 139.7292),      # near Otsuka Mosque
    District("Yoyogi-Uehara", 35.6699, 139.6856),  # Tokyo Camii
    District("Roppongi", 35.6628, 139.7314),
    District("Ginza", 35.6717, 139.7650),
    District("Akihabara", 35.7022, 139.7745),
    District("Ueno", 35.7138, 139.7770),
    District("Ikebukuro", 35.7295, 139.7109),
    District("Shinagawa", 35.6284, 139.7387),
    District("Kichijoji", 35.7029, 139.5805),
    District("Tokyo Station", 35.6812, 139.7671),
]

OSAKA = [
    District("Namba", 34.6660, 135.5022),
    District("Umeda", 34.7029, 135.4954),
    District("Tennoji", 34.6457, 135.5135),
    District("Shinsaibashi", 34.6750, 135.5008),
    District("Osaka Mosque area", 34.7050, 135.4945),  # Nishiyodogawa
    District("Tsuruhashi", 34.6655, 135.5380),         # Korean district
    District("Kyobashi", 34.6970, 135.5354),
    District("Tennoji Park", 34.6531, 135.5135),
]

KYOTO = [
    District("Kyoto Station", 34.9858, 135.7588),
    District("Gion", 35.0036, 135.7758),
    District("Arashiyama", 35.0094, 135.6663),
    District("Higashiyama", 34.9988, 135.7820),
    District("Kawaramachi", 35.0036, 135.7681),
    District("Kyoto University area", 35.0259, 135.7805),
]

SEOUL = [
    District("Itaewon", 37.5345, 126.9943),     # central mosque, halal hub
    District("Hannam-dong", 37.5389, 126.9988),
    District("Myeongdong", 37.5636, 126.9826),
    District("Hongdae", 37.5563, 126.9236),
    District("Gangnam", 37.4979, 127.0276),
    District("Dongdaemun", 37.5663, 127.0091),
    District("Insadong", 37.5740, 126.9854),
    District("Jongno", 37.5704, 126.9834),
    District("Yeouido", 37.5219, 126.9245),
]

BANGKOK = [
    District("Bang Rak", 13.7273, 100.5167),    # historic Muslim area
    District("Phra Khanong", 13.7140, 100.5980),  # mosque cluster
    District("Sukhumvit", 13.7390, 100.5601),
    District("Silom", 13.7245, 100.5341),
    District("Siam", 13.7460, 100.5339),
    District("Chinatown", 13.7437, 100.5125),
    District("Khao San", 13.7588, 100.4977),
    District("Pratunam", 13.7501, 100.5400),
    District("Ari", 13.7794, 100.5440),
    District("Bang Lamphu", 13.7587, 100.4970),
]

SINGAPORE = [
    District("Kampong Glam", 1.3022, 103.8590),  # Sultan Mosque
    District("Bugis", 1.3009, 103.8559),
    District("Geylang Serai", 1.3175, 103.8961),  # heart of Malay/Muslim community
    District("Tanjong Pagar", 1.2766, 103.8451),
    District("Little India", 1.3068, 103.8517),
    District("Orchard", 1.3048, 103.8318),
    District("Tampines", 1.3525, 103.9447),
    District("Jurong East", 1.3329, 103.7436),
    District("Marina Bay", 1.2837, 103.8607),
    District("Joo Chiat", 1.3107, 103.9020),
]

TAIPEI = [
    District("Da'an", 25.0264, 121.5436),       # Taipei Grand Mosque
    District("Xinyi", 25.0330, 121.5654),
    District("Zhongshan", 25.0633, 121.5266),
    District("Wanhua", 25.0356, 121.4992),
    District("Datong", 25.0653, 121.5142),
    District("Songshan", 25.0500, 121.5575),
    District("Ximen", 25.0421, 121.5081),
]


CITIES: dict[str, list[District]] = {
    "tokyo": TOKYO,
    "osaka": OSAKA,
    "kyoto": KYOTO,
    "seoul": SEOUL,
    "bangkok": BANGKOK,
    "singapore": SINGAPORE,
    "taipei": TAIPEI,
    # Tier-2 cities below — popular Asian destinations with growing or
    # established Muslim tourist traffic.
    "hong_kong": [],  # populated below
    "ho_chi_minh": [],
    "hanoi": [],
    "chiang_mai": [],
    "phuket": [],
    "manila": [],
}


# ============================================
# Tier-2 districts
# ============================================

HONG_KONG = [
    District("Tsim Sha Tsui", 22.2980, 114.1719),  # Kowloon Mosque area
    District("Wan Chai", 22.2778, 114.1740),       # Wan Chai Mosque
    District("Causeway Bay", 22.2802, 114.1854),
    District("Mong Kok", 22.3193, 114.1694),
    District("Central", 22.2818, 114.1582),
    District("Sheung Wan", 22.2867, 114.1499),
    District("Yau Ma Tei", 22.3137, 114.1707),
    District("Tsuen Wan", 22.3719, 114.1141),
]

HO_CHI_MINH = [
    District("District 1 — Dong Du Mosque area", 10.7770, 106.7042),
    District("District 1 — Pham Ngu Lao", 10.7672, 106.6919),
    District("District 1 — Ben Thanh", 10.7723, 106.6981),
    District("District 3", 10.7820, 106.6868),
    District("District 5 — Cholon", 10.7546, 106.6634),
    District("District 7 — Phu My Hung", 10.7298, 106.7196),
    District("Tan Binh", 10.8011, 106.6529),
]

HANOI = [
    District("Old Quarter", 21.0341, 105.8500),
    District("Hoan Kiem", 21.0285, 105.8542),
    District("Ba Dinh — Hanoi Mosque area", 21.0365, 105.8295),
    District("Tay Ho — expat area", 21.0710, 105.8240),
    District("Cau Giay", 21.0339, 105.7853),
    District("Dong Da", 21.0151, 105.8312),
]

CHIANG_MAI = [
    District("Old City", 18.7892, 98.9851),
    District("Nimman", 18.8003, 98.9698),
    District("Night Bazaar", 18.7878, 98.9976),
    District("Ban Haw Mosque area", 18.7888, 98.9942),
    District("Chang Khlan", 18.7855, 98.9989),
    District("Suthep", 18.7958, 98.9495),
]

PHUKET = [
    District("Patong", 7.8956, 98.2967),
    District("Karon", 7.8463, 98.2958),
    District("Kata", 7.8181, 98.2982),
    District("Phuket Town", 7.8804, 98.3923),
    District("Bang Tao", 7.9920, 98.2958),
    District("Old Phuket", 7.8843, 98.3892),
    District("Chalong", 7.8400, 98.3411),
]

MANILA = [
    District("Quiapo — Golden Mosque area", 14.5995, 120.9844),
    District("Ermita", 14.5781, 120.9824),
    District("Malate", 14.5686, 120.9849),
    District("Makati", 14.5547, 121.0244),
    District("Bonifacio Global City", 14.5500, 121.0500),
    District("Salam Compound — Taguig", 14.5197, 121.0510),
    District("Manila Bay area", 14.5824, 120.9786),
]


# Wire tier-2 entries into CITIES dict.
CITIES["hong_kong"] = HONG_KONG
CITIES["ho_chi_minh"] = HO_CHI_MINH
CITIES["hanoi"] = HANOI
CITIES["chiang_mai"] = CHIANG_MAI
CITIES["phuket"] = PHUKET
CITIES["manila"] = MANILA


def list_cities() -> list[str]:
    return sorted(CITIES.keys())


def get_districts(city: str) -> list[District]:
    if city not in CITIES:
        raise ValueError(f"Unknown city: {city}. Available: {list_cities()}")
    return CITIES[city]
