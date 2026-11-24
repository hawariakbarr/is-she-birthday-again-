export type SheetId = 'covers' | 'spines' | 'fix' | 'fix2';

export type FilmId =
  | 'valley'
  | 'bluehour'
  | 'river'
  | 'summer'
  | 'green'
  | 'noon'
  | 'observer'
  | 'birds'
  | 'storm'
  | 'tide'
  | 'war'
  | 'door';

export type DecadeId = 'all' | '1950s' | '1960s' | '1970s' | '1980s';

export type CropKey = `spine-${FilmId}` | `cover-${FilmId}`;

export interface Film {
  readonly id: FilmId;
  readonly title: string;
  readonly romaji: string;
  readonly kanji: string;
  readonly year: number;
  readonly genre: string;
  readonly minutes: number;
  readonly synopsis: string;
}

export interface DecadeTab {
  readonly id: DecadeId;
  readonly label: string;
  readonly targetIndex: number;
}

export interface InkBlobSpec {
  readonly cx: number;
  readonly cy: number;
  readonly delay: number;
}

export const SHEETS: Record<SheetId, readonly [url: string, width: number, height: number]> = {
  covers: [
    'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261029_010644_837e04ca-2418-45c1-b8e0-0233265c4cd5.png&w=1744&q=85',
    1744,
    2336,
  ],
  spines: [
    'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261029_010738_a3e47ead-18f2-4974-9468-06d16a25edc5.png&w=2688&q=85',
    2688,
    1152,
  ],
  fix: [
    'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261029_010831_3ebb874b-93dc-433e-87ed-6299aba720f0.png&w=1520&q=85',
    1520,
    2688,
  ],
  fix2: [
    'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261029_092020_f96bc094-db7b-46de-9298-074a24e0a3b8.png&w=1520&q=85',
    1520,
    2688,
  ],
};

export const CROPS: Record<CropKey, readonly [sheet: SheetId, x: number, y: number, w: number, h: number]> = {
  'spine-valley': ['spines', 266, 31, 189, 1089],
  'cover-valley': ['covers', 497, 72, 344, 659],

  'spine-bluehour': ['spines', 492, 31, 189, 1089],
  'cover-bluehour': ['covers', 914, 72, 342, 659],

  'spine-river': ['fix', 197, 54, 324, 2566],
  'cover-river': ['covers', 1332, 72, 344, 659],

  'spine-summer': ['spines', 937, 31, 188, 1089],
  'cover-summer': ['covers', 74, 813, 344, 676],

  'spine-green': ['spines', 1157, 31, 185, 1090],
  'cover-green': ['covers', 497, 815, 344, 674],

  'spine-noon': ['spines', 44, 32, 184, 1088],
  'cover-noon': ['covers', 74, 72, 347, 659],

  'spine-observer': ['fix2', 371, 15, 349, 2655],
  'cover-observer': ['covers', 915, 815, 342, 675],

  'spine-birds': ['spines', 1573, 31, 183, 1089],
  'cover-birds': ['covers', 1331, 815, 345, 675],

  'spine-storm': ['fix2', 808, 15, 347, 2656],
  'cover-storm': ['covers', 74, 1571, 345, 681],

  'spine-tide': ['spines', 2012, 31, 188, 1089],
  'cover-tide': ['covers', 496, 1577, 343, 678],

  'spine-war': ['spines', 2236, 31, 189, 1089],
  'cover-war': ['covers', 913, 1579, 343, 676],

  'spine-door': ['spines', 2462, 31, 188, 1089],
  'cover-door': ['covers', 1331, 1579, 344, 677],
};

export const FILMS: readonly Film[] = [
  {
    id: 'valley',
    title: 'The Silent Valley',
    romaji: 'SHIZUKANA TANI',
    kanji: '静かな谷',
    year: 1958,
    genre: 'Drama',
    minutes: 104,
    synopsis:
      'A schoolteacher returns to the mountain village that exiled her father, and finds the valley has kept every one of its secrets.',
  },
  {
    id: 'bluehour',
    title: 'The Blue Hour',
    romaji: 'AO NO TOKI',
    kanji: '青の刻',
    year: 1962,
    genre: 'Romance',
    minutes: 97,
    synopsis:
      'Over one long evening in a harbour town, a widow and a stranger trade small lies until the light runs out.',
  },
  {
    id: 'river',
    title: 'River of Salt',
    romaji: 'SHIO NO KAWA',
    kanji: '塩の川',
    year: 1964,
    genre: 'Drama',
    minutes: 121,
    synopsis:
      'Two brothers drag a salt barge downriver to a city that no longer wants anything they carry.',
  },
  {
    id: 'summer',
    title: 'The Last Summer',
    romaji: 'SAIGO NO NATSU',
    kanji: '最後の夏',
    year: 1966,
    genre: 'Drama',
    minutes: 109,
    synopsis:
      'The summer before the dam floods their village, three friends set fire to everything they cannot take with them.',
  },
  {
    id: 'green',
    title: 'The Green Road',
    romaji: 'MIDORI NO MICHI',
    kanji: '緑の道',
    year: 1969,
    genre: 'Mystery',
    minutes: 101,
    synopsis:
      'A surveyor mapping a forest road keeps finding the same footprints, always one day ahead of him.',
  },
  {
    id: 'noon',
    title: 'Noon in Ashes',
    romaji: 'HAI NO SHOGO',
    kanji: '灰の正午',
    year: 1971,
    genre: 'Western',
    minutes: 112,
    synopsis:
      'A rider crosses a white desert to settle an old debt, and learns too late who sent him.',
  },
  {
    id: 'observer',
    title: 'The Observer',
    romaji: 'KANSATSUSHA',
    kanji: '観察者',
    year: 1973,
    genre: 'Thriller',
    minutes: 96,
    synopsis:
      'A night watchman begins to suspect that the building he guards has started watching him back.',
  },
  {
    id: 'birds',
    title: 'The Fallen Birds',
    romaji: 'OCHITA TORI',
    kanji: '落ちた鳥',
    year: 1975,
    genre: 'Drama',
    minutes: 118,
    synopsis:
      "When the birds stop singing over a frontier town, the mayor's daughter is the only one who goes looking for the reason.",
  },
  {
    id: 'storm',
    title: 'Light in the Storm',
    romaji: 'ARASHI NO HI',
    kanji: '嵐の灯',
    year: 1978,
    genre: 'Drama',
    minutes: 127,
    synopsis:
      'A lighthouse keeper and his son wait out a three-day storm with a shipwrecked sailor who will not give his name.',
  },
  {
    id: 'tide',
    title: 'The Long Tide',
    romaji: 'NAGAI SHIO',
    kanji: '長い潮',
    year: 1981,
    genre: 'Drama',
    minutes: 99,
    synopsis:
      "A fisherman's wife counts the tides on the harbour wall while her husband's boat fails to come home.",
  },
  {
    id: 'war',
    title: 'A Quiet War',
    romaji: 'SHIZUKANA SENSO',
    kanji: '静かな戦争',
    year: 1985,
    genre: 'Comedy',
    minutes: 103,
    synopsis:
      'Two neighbours fight a silent war over a garden wall for thirty years, and neither will say how it began.',
  },
  {
    id: 'door',
    title: 'Red Door',
    romaji: 'AKAI TOBIRA',
    kanji: '赤い扉',
    year: 1989,
    genre: 'Thriller',
    minutes: 114,
    synopsis:
      'A projectionist follows a reel of unknown film through the corridors of a cinema on its final night.',
  },
];

export const DECADES: readonly DecadeTab[] = [
  { id: 'all', label: 'All / すべて', targetIndex: 0 },
  { id: '1950s', label: '1950s', targetIndex: 0 },
  { id: '1960s', label: '1960s', targetIndex: 1 },
  { id: '1970s', label: '1970s', targetIndex: 5 },
  { id: '1980s', label: '1980s', targetIndex: 9 },
];

export const INK_BLOBS: readonly InkBlobSpec[] = [
  { cx: 150, cy: 330, delay: 0 },
  { cx: 340, cy: 600, delay: 120 },
  { cx: 250, cy: 120, delay: 220 },
  { cx: 90, cy: 760, delay: 300 },
  { cx: 400, cy: 250, delay: 360 },
  { cx: 260, cy: 860, delay: 420 },
  { cx: 230, cy: 470, delay: 180 },
];

export const FILM_COUNT = FILMS.length;
export const SHELF_COPIES = 3;
export const TOTAL_TAPES = FILM_COUNT * SHELF_COPIES;
export const INITIAL_FILM_INDEX = 5; // Noon in Ashes
export const INITIAL_SCROLL = INITIAL_FILM_INDEX + FILM_COUNT; // 17 (middle copy)
export const POSTER_WIDTH = 474;
export const POSTER_HEIGHT = 900;
