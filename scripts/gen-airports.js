#!/usr/bin/env node
/**
 * Writes public/data/airports.json: IATA code → IANA time zone, from the
 * OpenFlights airports table (public domain data, ~7,700 airports). The app
 * loads it lazily (AirportZoneService) to put each flight time in its own
 * airport's zone. Rerun when a code is missing:  node scripts/gen-airports.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';
https.get(URL, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    // Airports newer than the dataset, or missing a zone there.
    const out = { BER: 'Europe/Berlin' };
    for (const line of body.split('\n')) {
      // CSV with quoted strings; fields: id,name,city,country,IATA,ICAO,lat,lng,alt,offset,dst,tz,type,source
      const cells = line.match(/("([^"]*)"|[^,]*)(,|$)/g)?.map(c => c.replace(/,$/, '').replace(/^"|"$/g, '')) ?? [];
      const iata = cells[4], tz = cells[11];
      if (!iata || iata === '\\N' || iata.length !== 3 || !tz || tz === '\\N' || !tz.includes('/')) continue;
      out[iata] = tz;
    }
    const file = path.join(__dirname, '..', 'public', 'data', 'airports.json');
    fs.writeFileSync(file, JSON.stringify(out));
    console.log(`wrote ${path.relative(process.cwd(), file)}: ${Object.keys(out).length} airports, ${Math.round(fs.statSync(file).size / 1024)} KB`);
  });
}).on('error', e => { console.error('failed:', e.message); process.exit(1); });
