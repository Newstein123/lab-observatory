/**
 * Places to observe from: major cities (their centres, so typically very
 * light-polluted) and well-known dark sites. Coordinates RETRIEVED (rounded);
 * the light-pollution class is ESTIMATED for the city centre; outskirts are
 * darker, so the user can lower it.
 */

export interface ObservingSite {
  id: string;
  name: string;
  country: string;
  latDeg: number;
  lonDeg: number;
  elevationM: number;
  /** IANA time zone, for local times. */
  timeZone: string;
  /** Typical Bortle class (1 darkest … 9 inner city). */
  bortle: number;
  kind: "city" | "dark-site";
}

type Row = [id: string, name: string, country: string, lat: number, lon: number, elev: number, tz: string, bortle: number];

const CITIES: Row[] = [
  // South-East Asia
  ["bangkok", "Bangkok", "Thailand", 13.7563, 100.5018, 2, "Asia/Bangkok", 9],
  ["chiang-mai", "Chiang Mai", "Thailand", 18.7883, 98.9853, 310, "Asia/Bangkok", 7],
  ["phuket", "Phuket", "Thailand", 7.8804, 98.3923, 10, "Asia/Bangkok", 6],
  ["khon-kaen", "Khon Kaen", "Thailand", 16.4419, 102.836, 165, "Asia/Bangkok", 7],
  ["yangon", "Yangon", "Myanmar", 16.8409, 96.1735, 20, "Asia/Yangon", 8],
  ["mandalay", "Mandalay", "Myanmar", 21.9588, 96.0891, 80, "Asia/Yangon", 7],
  ["naypyidaw", "Naypyidaw", "Myanmar", 19.7633, 96.0785, 115, "Asia/Yangon", 6],
  ["vientiane", "Vientiane", "Laos", 17.9757, 102.6331, 174, "Asia/Vientiane", 7],
  ["phnom-penh", "Phnom Penh", "Cambodia", 11.5564, 104.9282, 12, "Asia/Phnom_Penh", 8],
  ["hanoi", "Hanoi", "Vietnam", 21.0285, 105.8542, 20, "Asia/Ho_Chi_Minh", 9],
  ["ho-chi-minh", "Ho Chi Minh City", "Vietnam", 10.8231, 106.6297, 19, "Asia/Ho_Chi_Minh", 9],
  ["kuala-lumpur", "Kuala Lumpur", "Malaysia", 3.139, 101.6869, 60, "Asia/Kuala_Lumpur", 9],
  ["singapore", "Singapore", "Singapore", 1.3521, 103.8198, 15, "Asia/Singapore", 9],
  ["jakarta", "Jakarta", "Indonesia", -6.2088, 106.8456, 8, "Asia/Jakarta", 9],
  ["bali", "Denpasar (Bali)", "Indonesia", -8.6705, 115.2126, 10, "Asia/Makassar", 7],
  ["manila", "Manila", "Philippines", 14.5995, 120.9842, 10, "Asia/Manila", 9],
  // East & South Asia
  ["tokyo", "Tokyo", "Japan", 35.6762, 139.6503, 40, "Asia/Tokyo", 9],
  ["osaka", "Osaka", "Japan", 34.6937, 135.5023, 20, "Asia/Tokyo", 9],
  ["seoul", "Seoul", "South Korea", 37.5665, 126.978, 38, "Asia/Seoul", 9],
  ["beijing", "Beijing", "China", 39.9042, 116.4074, 44, "Asia/Shanghai", 9],
  ["shanghai", "Shanghai", "China", 31.2304, 121.4737, 4, "Asia/Shanghai", 9],
  ["hong-kong", "Hong Kong", "China", 22.3193, 114.1694, 30, "Asia/Hong_Kong", 9],
  ["taipei", "Taipei", "Taiwan", 25.033, 121.5654, 10, "Asia/Taipei", 9],
  ["delhi", "New Delhi", "India", 28.6139, 77.209, 216, "Asia/Kolkata", 9],
  ["mumbai", "Mumbai", "India", 19.076, 72.8777, 14, "Asia/Kolkata", 9],
  ["bengaluru", "Bengaluru", "India", 12.9716, 77.5946, 920, "Asia/Kolkata", 9],
  ["kathmandu", "Kathmandu", "Nepal", 27.7172, 85.324, 1400, "Asia/Kathmandu", 7],
  ["dhaka", "Dhaka", "Bangladesh", 23.8103, 90.4125, 4, "Asia/Dhaka", 9],
  ["colombo", "Colombo", "Sri Lanka", 6.9271, 79.8612, 5, "Asia/Colombo", 8],
  // Middle East & Africa
  ["dubai", "Dubai", "UAE", 25.2048, 55.2708, 5, "Asia/Dubai", 9],
  ["riyadh", "Riyadh", "Saudi Arabia", 24.7136, 46.6753, 612, "Asia/Riyadh", 9],
  ["istanbul", "Istanbul", "Türkiye", 41.0082, 28.9784, 40, "Europe/Istanbul", 9],
  ["cairo", "Cairo", "Egypt", 30.0444, 31.2357, 23, "Africa/Cairo", 9],
  ["nairobi", "Nairobi", "Kenya", -1.2921, 36.8219, 1795, "Africa/Nairobi", 8],
  ["lagos", "Lagos", "Nigeria", 6.5244, 3.3792, 41, "Africa/Lagos", 8],
  ["johannesburg", "Johannesburg", "South Africa", -26.2041, 28.0473, 1753, "Africa/Johannesburg", 8],
  ["cape-town", "Cape Town", "South Africa", -33.9249, 18.4241, 25, "Africa/Johannesburg", 8],
  // Europe
  ["london", "London", "United Kingdom", 51.5074, -0.1278, 11, "Europe/London", 9],
  ["edinburgh", "Edinburgh", "United Kingdom", 55.9533, -3.1883, 47, "Europe/London", 8],
  ["paris", "Paris", "France", 48.8566, 2.3522, 35, "Europe/Paris", 9],
  ["berlin", "Berlin", "Germany", 52.52, 13.405, 34, "Europe/Berlin", 9],
  ["madrid", "Madrid", "Spain", 40.4168, -3.7038, 667, "Europe/Madrid", 9],
  ["rome", "Rome", "Italy", 41.9028, 12.4964, 21, "Europe/Rome", 9],
  ["amsterdam", "Amsterdam", "Netherlands", 52.3676, 4.9041, 0, "Europe/Amsterdam", 9],
  ["stockholm", "Stockholm", "Sweden", 59.3293, 18.0686, 28, "Europe/Stockholm", 8],
  ["moscow", "Moscow", "Russia", 55.7558, 37.6173, 156, "Europe/Moscow", 9],
  ["reykjavik", "Reykjavík", "Iceland", 64.1466, -21.9426, 15, "Atlantic/Reykjavik", 7],
  // Americas
  ["new-york", "New York", "USA", 40.7128, -74.006, 10, "America/New_York", 9],
  ["los-angeles", "Los Angeles", "USA", 34.0522, -118.2437, 89, "America/Los_Angeles", 9],
  ["chicago", "Chicago", "USA", 41.8781, -87.6298, 181, "America/Chicago", 9],
  ["denver", "Denver", "USA", 39.7392, -104.9903, 1609, "America/Denver", 8],
  ["tucson", "Tucson", "USA", 32.2226, -110.9747, 728, "America/Phoenix", 6],
  ["toronto", "Toronto", "Canada", 43.6532, -79.3832, 76, "America/Toronto", 9],
  ["vancouver", "Vancouver", "Canada", 49.2827, -123.1207, 70, "America/Vancouver", 8],
  ["mexico-city", "Mexico City", "Mexico", 19.4326, -99.1332, 2240, "America/Mexico_City", 9],
  ["sao-paulo", "São Paulo", "Brazil", -23.5505, -46.6333, 760, "America/Sao_Paulo", 9],
  ["buenos-aires", "Buenos Aires", "Argentina", -34.6037, -58.3816, 25, "America/Argentina/Buenos_Aires", 9],
  ["santiago", "Santiago", "Chile", -33.4489, -70.6693, 570, "America/Santiago", 9],
  ["lima", "Lima", "Peru", -12.0464, -77.0428, 154, "America/Lima", 9],
  // Oceania
  ["sydney", "Sydney", "Australia", -33.8688, 151.2093, 58, "Australia/Sydney", 8],
  ["melbourne", "Melbourne", "Australia", -37.8136, 144.9631, 31, "Australia/Melbourne", 8],
  ["perth", "Perth", "Australia", -31.9505, 115.8605, 31, "Australia/Perth", 8],
  ["auckland", "Auckland", "New Zealand", -36.8485, 174.7633, 20, "Pacific/Auckland", 8],
];

const DARK_SITES: Row[] = [
  ["doi-inthanon", "Doi Inthanon", "Thailand", 18.5888, 98.4869, 2500, "Asia/Bangkok", 2],
  ["khao-yai", "Khao Yai National Park", "Thailand", 14.4392, 101.3725, 750, "Asia/Bangkok", 3],
  ["inle-lake", "Inle Lake", "Myanmar", 20.5563, 96.9126, 880, "Asia/Yangon", 3],
  ["mauna-kea", "Mauna Kea", "USA", 19.8207, -155.4681, 4200, "Pacific/Honolulu", 1],
  ["atacama", "Atacama Desert (San Pedro)", "Chile", -22.9087, -68.1997, 2400, "America/Santiago", 1],
  ["la-palma", "La Palma (Roque de los Muchachos)", "Spain", 28.7606, -17.8816, 2396, "Atlantic/Canary", 1],
  ["namibrand", "NamibRand Nature Reserve", "Namibia", -25.0, 16.0, 1000, "Africa/Windhoek", 1],
  ["aoraki", "Aoraki Mackenzie", "New Zealand", -43.9856, 170.4646, 710, "Pacific/Auckland", 1],
  ["cherry-springs", "Cherry Springs State Park", "USA", 41.6628, -77.8236, 700, "America/New_York", 2],
];

const toSite = (kind: ObservingSite["kind"]) => ([id, name, country, latDeg, lonDeg, elevationM, timeZone, bortle]: Row): ObservingSite => ({
  id,
  name,
  country,
  latDeg,
  lonDeg,
  elevationM,
  timeZone,
  bortle,
  kind,
});

export const SITES: readonly ObservingSite[] = [...CITIES.map(toSite("city")), ...DARK_SITES.map(toSite("dark-site"))];

export const DEFAULT_SITE_ID = "bangkok";

export function getSite(id: string): ObservingSite | undefined {
  return SITES.find((s) => s.id === id);
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Sites matching a search, best first (name prefix, then name or country containing the query). */
export function searchSites(query: string, limit = 8): ObservingSite[] {
  const q = fold(query.trim());
  if (!q) return SITES.filter((s) => s.kind === "city").slice(0, limit);
  const scored = SITES.map((s) => {
    const name = fold(s.name);
    const score = name.startsWith(q) ? 0 : name.includes(q) ? 1 : fold(s.country).includes(q) ? 2 : -1;
    return { s, score };
  }).filter((x) => x.score >= 0);
  return scored.sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name)).slice(0, limit).map((x) => x.s);
}

/** A custom spot (from the phone's location or typed in). */
export function customSite(latDeg: number, lonDeg: number, opts: { name?: string; bortle?: number; timeZone?: string; elevationM?: number } = {}): ObservingSite {
  return {
    id: "custom",
    name: opts.name ?? `${Math.abs(latDeg).toFixed(2)}°${latDeg >= 0 ? "N" : "S"}, ${Math.abs(lonDeg).toFixed(2)}°${lonDeg >= 0 ? "E" : "W"}`,
    country: "",
    latDeg,
    lonDeg,
    elevationM: opts.elevationM ?? 0,
    timeZone: opts.timeZone ?? (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"),
    bortle: opts.bortle ?? 6,
    kind: "city",
  };
}
