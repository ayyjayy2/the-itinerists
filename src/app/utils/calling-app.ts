/**
 * Calling a place abroad (#611): the shared trip page notes which app works
 * for calling the country a stay is in, since a normal call from home costs
 * a lot. Most of the world uses WhatsApp; some countries use another app.
 */
const BY_COUNTRY: Record<string, string> = {
  thailand: 'LINE', japan: 'LINE', taiwan: 'LINE',
  'south korea': 'KakaoTalk', korea: 'KakaoTalk',
  china: 'WeChat',
  vietnam: 'Zalo', 'viet nam': 'Zalo',
};

/** The country in a destination like "Chiang Mai, Thailand" (its last part). */
export function countryOf(destination: string): string {
  const parts = destination.split(',').map(p => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/** The app people there use for calls and messages: LINE in Thailand, WhatsApp by default. */
export function callingApp(country: string): string {
  return BY_COUNTRY[country.trim().toLowerCase()] ?? 'WhatsApp';
}

/** A note for calling from home: "Calling from abroad? Try LINE, which most people in Thailand use." */
export function callingNote(country: string): string {
  const app = callingApp(country);
  return country
    ? `Calling from abroad? Try ${app}, which most people in ${country} use.`
    : `Calling from abroad? Try ${app}.`;
}

/** A typed phone number as a tel: target: digits and a leading +, nothing else. */
export function telTarget(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? '+' + digits.slice(1).replace(/\+/g, '') : digits.replace(/\+/g, '');
}
