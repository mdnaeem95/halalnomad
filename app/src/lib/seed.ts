/**
 * Seed script for HalalNomad.
 *
 * Usage:
 *   npx ts-node --esm src/lib/seed.ts
 *
 * Or paste the generated SQL from seed-data.sql directly into the Supabase SQL Editor.
 *
 * This file exists as the source of truth for seed data and can generate
 * the SQL insert statements.
 */

interface SeedPlace {
  name_en: string;
  name_local: string | null;
  address_en: string;
  address_local: string | null;
  latitude: number;
  longitude: number;
  cuisine_type: string;
  price_range: number;
  description: string;
  city: string;
}

const SEED_DATA: SeedPlace[] = [
  // ============================================
  // TOKYO, JAPAN
  // ============================================
  {
    name_en: "Naritaya Halal Ramen",
    name_local: "成田屋 ハラールラーメン",
    address_en: "1-17-4 Asakusa, Taito-ku, Tokyo",
    address_local: "東京都台東区浅草1-17-4",
    latitude: 35.7118,
    longitude: 139.7954,
    cuisine_type: "japanese",
    price_range: 1,
    description: "One of Tokyo's first fully Halal-certified ramen shops, located near Sensoji Temple in Asakusa. Popular with Muslim tourists.",
    city: "Tokyo",
  },
  {
    name_en: "Gyumon Halal Yakiniku",
    name_local: "牛門 ハラール焼肉",
    address_en: "3-25-3 Shinjuku, Shinjuku-ku, Tokyo",
    address_local: "東京都新宿区新宿3-25-3",
    latitude: 35.6905,
    longitude: 139.7005,
    cuisine_type: "japanese",
    price_range: 3,
    description: "Halal Japanese BBQ restaurant in Shinjuku serving premium wagyu beef. Halal-certified with Arabic-speaking staff.",
    city: "Tokyo",
  },
  {
    name_en: "Honolu Halal Bento",
    name_local: "ホノル ハラール弁当",
    address_en: "2-11-5 Kabukicho, Shinjuku-ku, Tokyo",
    address_local: "東京都新宿区歌舞伎町2-11-5",
    latitude: 35.6951,
    longitude: 139.7028,
    cuisine_type: "japanese",
    price_range: 1,
    description: "Affordable Halal bento boxes and set meals near Shinjuku Station. Great for a quick lunch.",
    city: "Tokyo",
  },
  {
    name_en: "Sekai Cafe Asakusa",
    name_local: "世界カフェ 浅草",
    address_en: "1-18-10 Asakusa, Taito-ku, Tokyo",
    address_local: "東京都台東区浅草1-18-10",
    latitude: 35.7125,
    longitude: 139.7948,
    cuisine_type: "other",
    price_range: 2,
    description: "Multicultural cafe near Sensoji offering Halal and vegetarian options. Good for coffee and light meals.",
    city: "Tokyo",
  },
  {
    name_en: "Ayam-Ya Halal Chicken",
    name_local: "アヤムヤ",
    address_en: "1-4-16 Hyakunincho, Shinjuku-ku, Tokyo",
    address_local: "東京都新宿区百人町1-4-16",
    latitude: 35.7007,
    longitude: 139.6998,
    cuisine_type: "malaysian",
    price_range: 1,
    description: "Malaysian-style Halal chicken rice near Shin-Okubo. A favourite among the local Muslim community.",
    city: "Tokyo",
  },

  // ============================================
  // BEIJING, CHINA
  // ============================================
  {
    name_en: "Niu Jie Hui Min Restaurant",
    name_local: "牛街惠民小吃",
    address_en: "Niu Jie, Xicheng District, Beijing",
    address_local: "北京市西城区牛街5号",
    latitude: 39.8870,
    longitude: 116.3580,
    cuisine_type: "chinese_muslim",
    price_range: 1,
    description: "Traditional Hui Muslim snack shop on Niu Jie (Ox Street), Beijing's historic Muslim quarter. Famous for niangao and fried dough.",
    city: "Beijing",
  },
  {
    name_en: "Hongbinlou Restaurant",
    name_local: "鸿宾楼",
    address_en: "11 Zhanlanguan Lu, Xicheng District, Beijing",
    address_local: "北京市西城区展览馆路11号",
    latitude: 39.9145,
    longitude: 116.3358,
    cuisine_type: "chinese_muslim",
    price_range: 3,
    description: "Historic Halal restaurant established in 1853. Famous for Qingzhen (Halal) cuisine, especially lamb dishes and sesame cakes.",
    city: "Beijing",
  },
  {
    name_en: "Jingwei Mian Dawang",
    name_local: "京味面大王",
    address_en: "68 Niu Jie, Xicheng District, Beijing",
    address_local: "北京市西城区牛街68号",
    latitude: 39.8865,
    longitude: 116.3576,
    cuisine_type: "chinese_muslim",
    price_range: 1,
    description: "Popular hand-pulled noodle shop in the Niu Jie Muslim quarter. Excellent beef noodle soup.",
    city: "Beijing",
  },
  {
    name_en: "Tuyuegou Halal Restaurant",
    name_local: "吐月沟新疆餐厅",
    address_en: "Wudaokou, Haidian District, Beijing",
    address_local: "北京市海淀区五道口华清嘉园",
    latitude: 39.9927,
    longitude: 116.3381,
    cuisine_type: "central_asian",
    price_range: 2,
    description: "Authentic Uyghur restaurant near Wudaokou. Known for da pan ji (big plate chicken), lamb kebabs, and hand-pulled laghman noodles.",
    city: "Beijing",
  },
  {
    name_en: "Donglaishun Hot Pot",
    name_local: "东来顺",
    address_en: "16 Jinyu Hutong, Dongcheng District, Beijing",
    address_local: "北京市东城区金鱼胡同16号",
    latitude: 39.9168,
    longitude: 116.4108,
    cuisine_type: "chinese_muslim",
    price_range: 3,
    description: "Iconic Halal hot pot chain since 1903. Specialises in instant-boiled mutton (shuan yangrou). A Beijing institution.",
    city: "Beijing",
  },

  // ============================================
  // XI'AN, CHINA (Muslim Quarter)
  // ============================================
  {
    name_en: "Lao Sun Jia Restaurant",
    name_local: "老孙家饭庄",
    address_en: "364 Dong Dajie, Beilin District, Xi'an",
    address_local: "西安市碑林区东大街364号",
    latitude: 34.2614,
    longitude: 108.9540,
    cuisine_type: "chinese_muslim",
    price_range: 2,
    description: "Century-old Halal restaurant famous for yangrou paomo (crumbled bread in lamb soup), Xi'an's signature Muslim dish.",
    city: "Xi'an",
  },
  {
    name_en: "Jia San Guantang Baozi",
    name_local: "贾三灌汤包子",
    address_en: "Muslim Quarter, 93 Beiyuanmen, Lianhu District, Xi'an",
    address_local: "西安市莲湖区北院门93号",
    latitude: 34.2628,
    longitude: 108.9418,
    cuisine_type: "chinese_muslim",
    price_range: 1,
    description: "Famous for soup-filled dumplings (guantang baozi) in the heart of Xi'an's Muslim Quarter. A must-visit street food spot.",
    city: "Xi'an",
  },
  {
    name_en: "Muslim Quarter Night Market",
    name_local: "回民街夜市",
    address_en: "Beiyuanmen, Lianhu District, Xi'an",
    address_local: "西安市莲湖区北院门回民街",
    latitude: 34.2631,
    longitude: 108.9410,
    cuisine_type: "chinese_muslim",
    price_range: 1,
    description: "Xi'an's iconic Muslim Quarter food street. Hundreds of Halal stalls selling roujiamo, lamb skewers, persimmon cakes, and more.",
    city: "Xi'an",
  },

  // ============================================
  // SEOUL, SOUTH KOREA
  // ============================================
  {
    name_en: "Makan Halal Restaurant",
    name_local: "마칸 할랄 레스토랑",
    address_en: "34 Usadan-ro 10-gil, Yongsan-gu, Seoul",
    address_local: "서울특별시 용산구 우사단로10길 34",
    latitude: 37.5340,
    longitude: 126.9870,
    cuisine_type: "malaysian",
    price_range: 2,
    description: "Popular Halal restaurant in Itaewon serving Malaysian and Southeast Asian dishes. Well-known in the Muslim expat community.",
    city: "Seoul",
  },
  {
    name_en: "Busan Jib Korean BBQ",
    name_local: "부산집 할랄 고기",
    address_en: "27-8 Itaewon-dong, Yongsan-gu, Seoul",
    address_local: "서울특별시 용산구 이태원동 27-8",
    latitude: 37.5347,
    longitude: 126.9862,
    cuisine_type: "korean",
    price_range: 2,
    description: "Halal Korean BBQ in Itaewon. One of the few places to get Halal bulgogi and samgyeopsal in Seoul.",
    city: "Seoul",
  },
  {
    name_en: "Eid Halal Korean Food",
    name_local: "이드 할랄 한식",
    address_en: "13 Usadan-ro, Yongsan-gu, Seoul",
    address_local: "서울특별시 용산구 우사단로 13",
    latitude: 37.5338,
    longitude: 126.9875,
    cuisine_type: "korean",
    price_range: 2,
    description: "Halal Korean food including bibimbap, japchae, and fried chicken. Located near the Seoul Central Mosque.",
    city: "Seoul",
  },
  {
    name_en: "Kervan Turkish Restaurant",
    name_local: "케르반 터키 레스토랑",
    address_en: "120 Itaewon-ro, Yongsan-gu, Seoul",
    address_local: "서울특별시 용산구 이태원로 120",
    latitude: 37.5345,
    longitude: 126.9858,
    cuisine_type: "turkish",
    price_range: 2,
    description: "Authentic Turkish restaurant near Itaewon. Serves kebabs, pide, and Turkish tea. Halal-certified.",
    city: "Seoul",
  },

  // ============================================
  // LONDON, UK
  // ============================================
  {
    name_en: "Dishoom King's Cross",
    name_local: null,
    address_en: "5 Stable Street, King's Cross, London N1C 4AB",
    address_local: null,
    latitude: 51.5358,
    longitude: -0.1248,
    cuisine_type: "indian",
    price_range: 2,
    description: "Bombay-inspired cafe with Halal meat options. Famous for their bacon naan roll and black daal. Multiple London locations.",
    city: "London",
  },
  {
    name_en: "Tayyabs",
    name_local: null,
    address_en: "83-89 Fieldgate Street, Whitechapel, London E1 1JU",
    address_local: null,
    latitude: 51.5155,
    longitude: -0.0620,
    cuisine_type: "pakistani",
    price_range: 2,
    description: "Legendary Punjabi restaurant in Whitechapel. Famous for their dry lamb chops and seekh kebabs. Always packed — arrive early.",
    city: "London",
  },
  {
    name_en: "Maroush Gardens",
    name_local: null,
    address_en: "1-3 Connaught Street, London W2 2DH",
    address_local: null,
    latitude: 51.5133,
    longitude: -0.1640,
    cuisine_type: "middle_eastern",
    price_range: 3,
    description: "Upscale Lebanese restaurant near Edgware Road. Excellent mixed grills, mezze, and fresh juices. Halal-certified.",
    city: "London",
  },
  {
    name_en: "Lahore Kebab House",
    name_local: null,
    address_en: "2-10 Umberston Street, Whitechapel, London E1 1PY",
    address_local: null,
    latitude: 51.5150,
    longitude: -0.0611,
    cuisine_type: "pakistani",
    price_range: 1,
    description: "No-frills Pakistani grill house in Whitechapel. BYO, cash only, incredible lamb karahi. A London institution since 1972.",
    city: "London",
  },
  {
    name_en: "The Halal Guys",
    name_local: null,
    address_en: "326 Earls Court Road, London SW5 9BQ",
    address_local: null,
    latitude: 51.4903,
    longitude: -0.1950,
    cuisine_type: "middle_eastern",
    price_range: 1,
    description: "Famous NYC Halal cart chain. Chicken and gyro platters with their signature white and hot sauces.",
    city: "London",
  },

  // ============================================
  // PARIS, FRANCE
  // ============================================
  {
    name_en: "Le Marrakech",
    name_local: null,
    address_en: "2 Rue Daubenton, 75005 Paris",
    address_local: "2 Rue Daubenton, 75005 Paris",
    latitude: 48.8419,
    longitude: 2.3517,
    cuisine_type: "middle_eastern",
    price_range: 2,
    description: "Moroccan restaurant near the Grande Mosquée de Paris. Couscous, tagines, and mint tea in a traditional setting.",
    city: "Paris",
  },
  {
    name_en: "Restaurant de la Grande Mosquée",
    name_local: null,
    address_en: "39 Rue Geoffroy-Saint-Hilaire, 75005 Paris",
    address_local: "39 Rue Geoffroy-Saint-Hilaire, 75005 Paris",
    latitude: 48.8416,
    longitude: 2.3556,
    cuisine_type: "middle_eastern",
    price_range: 2,
    description: "Restaurant inside the iconic Grand Mosque of Paris. Beautiful courtyard with North African cuisine. A must-visit for Muslim travellers.",
    city: "Paris",
  },
  {
    name_en: "Chez Hamadi",
    name_local: null,
    address_en: "12 Rue Boutebrie, 75005 Paris",
    address_local: "12 Rue Boutebrie, 75005 Paris",
    latitude: 48.8505,
    longitude: 2.3466,
    cuisine_type: "middle_eastern",
    price_range: 2,
    description: "Cosy Tunisian restaurant in the Latin Quarter. Excellent couscous and brik pastries. Fully Halal.",
    city: "Paris",
  },
  {
    name_en: "L'As du Fallafel",
    name_local: null,
    address_en: "34 Rue des Rosiers, 75004 Paris",
    address_local: "34 Rue des Rosiers, 75004 Paris",
    latitude: 48.8568,
    longitude: 2.3577,
    cuisine_type: "middle_eastern",
    price_range: 1,
    description: "Iconic falafel spot in Le Marais. The Halal special with lamb shawarma and falafel is legendary. Expect queues.",
    city: "Paris",
  },

  // ============================================
  // ISTANBUL, TURKEY
  // ============================================
  {
    name_en: "Sultanahmet Koftecisi",
    name_local: "Sultanahmet Köftecisi",
    address_en: "Divanyolu Caddesi No:12, Sultanahmet, Istanbul",
    address_local: "Divanyolu Caddesi No:12, Sultanahmet, İstanbul",
    latitude: 41.0082,
    longitude: 28.9742,
    cuisine_type: "turkish",
    price_range: 1,
    description: "Istanbul's most famous kofte (meatball) restaurant, established in 1920. Simple menu — just kofte, beans, and bread. Perfect.",
    city: "Istanbul",
  },
  {
    name_en: "Karadeniz Pide Salonu",
    name_local: "Karadeniz Pide Salonu",
    address_en: "Hocapasa Sokak No:6, Sirkeci, Istanbul",
    address_local: "Hocapaşa Sokak No:6, Sirkeci, İstanbul",
    latitude: 41.0110,
    longitude: 28.9770,
    cuisine_type: "turkish",
    price_range: 1,
    description: "Black Sea-style pide (Turkish pizza) near Sirkeci station. Cheesy, boat-shaped flatbreads with various toppings. Local favourite.",
    city: "Istanbul",
  },
  {
    name_en: "Ciya Sofrasi",
    name_local: "Çiya Sofrası",
    address_en: "Caferaga Mahallesi, Guneslibahce Sokak No:43, Kadikoy, Istanbul",
    address_local: "Caferağa Mahallesi, Güneşlibahçe Sokak No:43, Kadıköy, İstanbul",
    latitude: 40.9903,
    longitude: 29.0260,
    cuisine_type: "turkish",
    price_range: 2,
    description: "Legendary Anatolian restaurant in Kadikoy. Seasonal menu with dishes from across Turkey you won't find elsewhere. A food lover's pilgrimage.",
    city: "Istanbul",
  },
  {
    name_en: "Hamdi Restaurant",
    name_local: "Hamdi Restaurant",
    address_en: "Tahmis Caddesi, Kalcin Sokak No:17, Eminonu, Istanbul",
    address_local: "Tahmis Caddesi, Kalçın Sokak No:17, Eminönü, İstanbul",
    latitude: 41.0175,
    longitude: 28.9710,
    cuisine_type: "turkish",
    price_range: 3,
    description: "Rooftop kebab restaurant with stunning views of the Golden Horn and Galata Bridge. Southeast Turkish cuisine at its finest.",
    city: "Istanbul",
  },

  // ============================================
  // BANGKOK, THAILAND
  // ============================================
  {
    name_en: "Yusup Pochana",
    name_local: "ยูซุป โภชนา",
    address_en: "Charoen Krung Road, Soi 36, Bang Rak, Bangkok",
    address_local: "ถนนเจริญกรุง ซอย 36 บางรัก กรุงเทพฯ",
    latitude: 13.7264,
    longitude: 100.5168,
    cuisine_type: "thai",
    price_range: 1,
    description: "Popular Halal Thai restaurant in the Bang Rak Muslim community. Excellent green curry and pad thai.",
    city: "Bangkok",
  },
  {
    name_en: "Saman Islam Restaurant",
    name_local: "ร้านสะมานอิสลาม",
    address_en: "Sukhumvit Soi 3/1, Wattana, Bangkok",
    address_local: "สุขุมวิท ซอย 3/1 วัฒนา กรุงเทพฯ",
    latitude: 13.7413,
    longitude: 100.5530,
    cuisine_type: "middle_eastern",
    price_range: 2,
    description: "Middle Eastern and Thai Halal restaurant on Soi Arab (Sukhumvit Soi 3). Shawarma, mandi rice, and Thai dishes.",
    city: "Bangkok",
  },
  {
    name_en: "Home Cuisine Islamic Restaurant",
    name_local: "ร้านอาหารอิสลาม โฮมคูซีน",
    address_en: "19 Soi Rambutri, Phra Nakhon, Bangkok",
    address_local: "19 ซอยรามบุตรี พระนคร กรุงเทพฯ",
    latitude: 13.7621,
    longitude: 100.4940,
    cuisine_type: "thai",
    price_range: 1,
    description: "Halal Thai food near Khao San Road. Popular with backpackers and Muslim travellers. Great massaman curry.",
    city: "Bangkok",
  },
  {
    name_en: "Sara-Jane's",
    name_local: "ซาร่า เจน",
    address_en: "36/2 Soi Sukhumvit 31, Wattana, Bangkok",
    address_local: "36/2 ซอยสุขุมวิท 31 วัฒนา กรุงเทพฯ",
    latitude: 13.7375,
    longitude: 100.5659,
    cuisine_type: "thai",
    price_range: 2,
    description: "Upscale Halal Thai restaurant in a colonial house. Refined Southern Thai cuisine. Halal-certified with prayer room.",
    city: "Bangkok",
  },

  // ============================================
  // SINGAPORE
  // ============================================
  {
    name_en: "Zam Zam Restaurant",
    name_local: null,
    address_en: "697-699 North Bridge Road, Singapore 198675",
    address_local: null,
    latitude: 1.3024,
    longitude: 103.8590,
    cuisine_type: "indian",
    price_range: 1,
    description: "Iconic murtabak restaurant opposite Sultan Mosque since 1908. Crispy stuffed pancakes with mutton, chicken, or sardine.",
    city: "Singapore",
  },
  {
    name_en: "Nasi Padang Minang",
    name_local: null,
    address_en: "18 Kandahar Street, Singapore 198884",
    address_local: null,
    latitude: 1.3020,
    longitude: 103.8587,
    cuisine_type: "indonesian",
    price_range: 1,
    description: "Authentic Padang-style rice with rich rendang, gulai, and sambal. Kampong Glam area near the mosque.",
    city: "Singapore",
  },
  {
    name_en: "The Coconut Club",
    name_local: null,
    address_en: "6 Ann Siang Hill, Singapore 069787",
    address_local: null,
    latitude: 1.2814,
    longitude: 103.8460,
    cuisine_type: "malaysian",
    price_range: 2,
    description: "Hip nasi lemak restaurant with a single-minded devotion to the perfect coconut rice. Halal-certified, stunning plating.",
    city: "Singapore",
  },
  {
    name_en: "Hajah Maimunah",
    name_local: null,
    address_en: "11 & 15 Jalan Pisang, Singapore 199078",
    address_local: null,
    latitude: 1.3031,
    longitude: 103.8560,
    cuisine_type: "malaysian",
    price_range: 1,
    description: "Award-winning Malay nasi padang restaurant. Legendary beef rendang, sayur lodeh, and sambal goreng. Always queued at lunch.",
    city: "Singapore",
  },

  // ============================================
  // DUBAI, UAE
  // ============================================
  {
    name_en: "Al Ustad Special Kabab",
    name_local: "الأستاذ كباب خاص",
    address_en: "Al Musalla Road, Al Fahidi, Bur Dubai",
    address_local: "شارع المصلى، الفهيدي، بر دبي",
    latitude: 25.2610,
    longitude: 55.2952,
    cuisine_type: "middle_eastern",
    price_range: 2,
    description: "Legendary Iranian kebab restaurant in old Dubai since 1978. The special kebab and saffron rice are must-orders.",
    city: "Dubai",
  },
  {
    name_en: "Ravi Restaurant",
    name_local: "مطعم رافي",
    address_en: "Al Satwa Road, Satwa, Dubai",
    address_local: "شارع السطوة، السطوة، دبي",
    latitude: 25.2277,
    longitude: 55.2690,
    cuisine_type: "pakistani",
    price_range: 1,
    description: "Dubai's most famous cheap eat. Pakistani home cooking at rock-bottom prices. The butter chicken and naan is legendary. Open since 1978.",
    city: "Dubai",
  },
  {
    name_en: "Al Mallah",
    name_local: "الملاح",
    address_en: "Al Dhiyafah Street, Satwa, Dubai",
    address_local: "شارع الضيافة، السطوة، دبي",
    latitude: 25.2310,
    longitude: 55.2695,
    cuisine_type: "middle_eastern",
    price_range: 1,
    description: "Popular shawarma and juice bar on Dhiyafah Street. Fresh fruit cocktails and crispy chicken shawarma. A late-night favourite.",
    city: "Dubai",
  },

  // ============================================
  // KUALA LUMPUR, MALAYSIA
  // ============================================
  {
    name_en: "Nasi Kandar Pelita",
    name_local: null,
    address_en: "149 Jalan Ampang, Kuala Lumpur 50450",
    address_local: null,
    latitude: 3.1575,
    longitude: 101.7189,
    cuisine_type: "malaysian",
    price_range: 1,
    description: "24-hour nasi kandar chain beloved by locals. Rich curries poured over rice, roti canai, and teh tarik. Multiple locations.",
    city: "Kuala Lumpur",
  },
  {
    name_en: "Restoran Rebung Chef Ismail",
    name_local: null,
    address_en: "Lot 3, Jalan Tanglin, Kuala Lumpur 59100",
    address_local: null,
    latitude: 3.1380,
    longitude: 101.6820,
    cuisine_type: "malaysian",
    price_range: 2,
    description: "Traditional Malay buffet by celebrity chef Ismail. Kampung-style dishes in a rustic setting. A showcase of Malay culinary heritage.",
    city: "Kuala Lumpur",
  },
  {
    name_en: "Village Park Restaurant",
    name_local: null,
    address_en: "5 Jalan SS 21/37, Damansara Utama, Petaling Jaya",
    address_local: null,
    latitude: 3.1341,
    longitude: 101.6245,
    cuisine_type: "malaysian",
    price_range: 1,
    description: "Famous for what many consider the best nasi lemak in KL. Crispy fried chicken, perfectly fragrant rice, and fiery sambal.",
    city: "Kuala Lumpur",
  },

  // ============================================
  // NEW YORK, USA
  // ============================================
  {
    name_en: "The Halal Guys",
    name_local: null,
    address_en: "W 53rd Street & 6th Avenue, Midtown Manhattan, New York",
    address_local: null,
    latitude: 40.7614,
    longitude: -73.9798,
    cuisine_type: "middle_eastern",
    price_range: 1,
    description: "The original Halal cart that started it all. Chicken and gyro over rice with white sauce. The queue is worth it.",
    city: "New York",
  },
  {
    name_en: "Adda Indian Canteen",
    name_local: null,
    address_en: "31-31 Thomson Avenue, Long Island City, New York 11101",
    address_local: null,
    latitude: 40.7442,
    longitude: -73.9350,
    cuisine_type: "indian",
    price_range: 2,
    description: "Michelin Bib Gourmand Indian restaurant serving Halal meat. Known for their biryani and innovative Indian street food.",
    city: "New York",
  },
  {
    name_en: "Kebab King",
    name_local: null,
    address_en: "73-01 37th Road, Jackson Heights, Queens, New York 11372",
    address_local: null,
    latitude: 40.7483,
    longitude: -73.8931,
    cuisine_type: "pakistani",
    price_range: 1,
    description: "No-frills Pakistani spot in Jackson Heights. Incredible nihari, haleem, and seekh kebabs. A local legend.",
    city: "New York",
  },
  {
    name_en: "Mamouns Falafel",
    name_local: null,
    address_en: "119 Macdougal Street, Greenwich Village, New York 10012",
    address_local: null,
    latitude: 40.7301,
    longitude: -74.0003,
    cuisine_type: "middle_eastern",
    price_range: 1,
    description: "NYC's oldest falafel shop since 1971. Cheap, fast, and delicious falafel and shawarma in the Village.",
    city: "New York",
  },

  // ============================================
  // BARCELONA, SPAIN
  // ============================================
  {
    name_en: "Pak Halal Restaurant",
    name_local: null,
    address_en: "Carrer de Joaquin Costa 6, El Raval, Barcelona 08001",
    address_local: null,
    latitude: 41.3818,
    longitude: 2.1685,
    cuisine_type: "pakistani",
    price_range: 1,
    description: "Popular Pakistani restaurant in El Raval. Hearty biryanis, curries, and fresh naan at great prices.",
    city: "Barcelona",
  },
  {
    name_en: "Marmara Restaurant",
    name_local: null,
    address_en: "Carrer dels Tallers 60, El Raval, Barcelona 08001",
    address_local: null,
    latitude: 41.3839,
    longitude: 2.1671,
    cuisine_type: "turkish",
    price_range: 1,
    description: "Turkish doner and kebabs in El Raval. Generous portions, late-night hours. Good for a quick Halal bite.",
    city: "Barcelona",
  },
  {
    name_en: "Restaurante Beirut",
    name_local: null,
    address_en: "Carrer de Muntaner 63, L'Eixample, Barcelona 08011",
    address_local: null,
    latitude: 41.3890,
    longitude: 2.1566,
    cuisine_type: "middle_eastern",
    price_range: 2,
    description: "Lebanese restaurant in Eixample with a warm atmosphere. Excellent mezze platter, grilled meats, and fresh hummus.",
    city: "Barcelona",
  },
];

/**
 * Generate SQL INSERT statements from seed data.
 */
function generateSQL(): string {
  const lines = SEED_DATA.map((p) => {
    const nameLocal = p.name_local ? `'${p.name_local.replace(/'/g, "''")}'` : 'NULL';
    const addressLocal = p.address_local ? `'${p.address_local.replace(/'/g, "''")}'` : 'NULL';

    return `  ('${p.name_en.replace(/'/g, "''")}', ${nameLocal}, '${p.address_en.replace(/'/g, "''")}', ${addressLocal}, ${p.latitude}, ${p.longitude}, 'WGS84', '${p.cuisine_type}', ${p.price_range}, 1, '${p.description.replace(/'/g, "''")}', '{}', true, 0)`;
  });

  return `-- HalalNomad Seed Data
-- Generated from src/lib/seed.ts
-- ${SEED_DATA.length} places across ${[...new Set(SEED_DATA.map((p) => p.city))].length} cities

INSERT INTO places (name_en, name_local, address_en, address_local, latitude, longitude, coord_system, cuisine_type, price_range, halal_level, description, photos, is_active, verification_count)
VALUES
${lines.join(',\n')};
`;
}

// When run directly, output the SQL
console.log(generateSQL());
