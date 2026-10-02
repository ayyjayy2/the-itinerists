/**
 * What a person types into a city search, made into something a place search
 * understands: the last part of a zone name ("Pacific/Port_Moresby" → "Port_Moresby"),
 * underscores as spaces ("Port_Moresby" → "Port Moresby"), extra spaces dropped.
 */
export function cityQuery(text) {
  const last = String(text ?? '').trim().split('/').pop();
  return last.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The lookup file a time zone code lives in (zone-codes/<name>.json): "EST" → "est", "est.json" → "est". */
export function zoneCodeFile(code) {
  return String(code ?? '').trim().toLowerCase().replace(/\.json$/, '').replace(/[^a-z0-9+]/g, '-');
}
