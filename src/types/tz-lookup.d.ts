declare module 'tz-lookup' {
  /** IANA time zone for a latitude/longitude, e.g. tzLookup(38.78, -9.13) → "Europe/Lisbon". */
  function tzLookup(lat: number, lng: number): string;
  export default tzLookup;
}
