// Mirrors src/app/utils/zones.ts (keep the two in step): the codes in everyday use for zones
// whose English locale data has no short name, keyed by the zone's long name; and a few
// offset-only zones mapped by hand.
export const CODE_BY_LONG_NAME = {
  'Indochina Time': 'ICT', 'Japan Standard Time': 'JST', 'Korean Standard Time': 'KST', 'China Standard Time': 'CST',
  'Taiwan Standard Time': 'CST', 'Philippine Standard Time': 'PHT', 'Western Indonesia Time': 'WIB', 'Central Indonesia Time': 'WITA',
  'Eastern Indonesia Time': 'WIT', 'Moscow Standard Time': 'MSK', 'Türkiye Standard Time': 'TRT', 'Israel Standard Time': 'IST',
  'Israel Daylight Time': 'IDT', 'Iran Standard Time': 'IRST', 'Iran Daylight Time': 'IRDT', 'Pakistan Standard Time': 'PKT',
  'Bangladesh Standard Time': 'BST', 'Arabian Standard Time': 'AST', 'Nepal Time': 'NPT', 'Myanmar Time': 'MMT', 'Bhutan Time': 'BTT',
  'Brunei Time': 'BNT', 'Timor-Leste Time': 'TLT', 'Afghanistan Time': 'AFT', 'Armenia Standard Time': 'AMT', 'Azerbaijan Standard Time': 'AZT',
  'Georgia Standard Time': 'GET', 'Kazakhstan Time': 'ALMT', 'Kyrgyzstan Time': 'KGT', 'Tajikistan Time': 'TJT',
  'Turkmenistan Standard Time': 'TMT', 'Uzbekistan Standard Time': 'UZT', 'Ulaanbaatar Standard Time': 'ULAT', 'Khovd Standard Time': 'HOVT',
  'Irkutsk Standard Time': 'IRKT', 'Krasnoyarsk Standard Time': 'KRAT', 'Omsk Standard Time': 'OMST', 'Yekaterinburg Standard Time': 'YEKT',
  'Samara Standard Time': 'SAMT', 'Vladivostok Standard Time': 'VLAT', 'Yakutsk Standard Time': 'YAKT', 'Magadan Standard Time': 'MAGT',
  'Kamchatka Standard Time': 'PETT', 'Brasilia Standard Time': 'BRT', 'Brasilia Summer Time': 'BRST', 'Argentina Standard Time': 'ART',
  'Colombia Standard Time': 'COT', 'Peru Standard Time': 'PET', 'Venezuela Time': 'VET', 'Bolivia Time': 'BOT', 'Ecuador Time': 'ECT',
  'Uruguay Standard Time': 'UYT', 'Paraguay Standard Time': 'PYT', 'Paraguay Summer Time': 'PYST', 'Chile Standard Time': 'CLT',
  'Chile Summer Time': 'CLST', 'Amazon Standard Time': 'AMT', 'Acre Standard Time': 'ACT', 'Fernando de Noronha Standard Time': 'FNT',
  'French Guiana Time': 'GFT', 'Guyana Time': 'GYT', 'Suriname Time': 'SRT', 'Mexican Pacific Standard Time': 'MST',
  'Cuba Standard Time': 'CST', 'Cuba Daylight Time': 'CDT', 'Yukon Time': 'MST', 'Greenland Summer Time': 'WGST',
  'Greenland Standard Time': 'WGT', 'Azores Summer Time': 'AZOST', 'Azores Standard Time': 'AZOT', 'Cape Verde Standard Time': 'CVT',
  'Greenwich Mean Time': 'GMT', 'Mauritius Standard Time': 'MUT', 'Réunion Time': 'RET', 'Seychelles Time': 'SCT', 'Maldives Time': 'MVT',
  'Indian Ocean Time': 'IOT', 'Fiji Standard Time': 'FJT', 'Samoa Standard Time': 'SST', 'American Samoa Standard Time': 'SST',
  'Chamorro Standard Time': 'ChST', 'Papua New Guinea Time': 'PGT', 'Solomon Islands Time': 'SBT', 'Vanuatu Standard Time': 'VUT',
  'New Caledonia Standard Time': 'NCT', 'Norfolk Island Standard Time': 'NFT', 'Tonga Standard Time': 'TOT', 'Tahiti Time': 'TAHT',
  'Marquesas Time': 'MART', 'Gambier Time': 'GAMT', 'Cook Islands Standard Time': 'CKT', 'Niue Time': 'NUT', 'Tokelau Time': 'TKT',
  'Tuvalu Time': 'TVT', 'Wallis & Futuna Time': 'WFT', 'Wake Island Time': 'WAKT', 'Palau Time': 'PWT', 'Nauru Time': 'NRT',
  'Kosrae Time': 'KOST', 'Pohnpei Time': 'PONT', 'Chuuk Time': 'CHUT', 'Marshall Islands Time': 'MHT', 'Gilbert Islands Time': 'GILT',
  'Phoenix Islands Time': 'PHOT', 'Line Islands Time': 'LINT', 'Pitcairn Time': 'PST', 'Galapagos Time': 'GALT',
  'Easter Island Standard Time': 'EAST', 'Easter Island Summer Time': 'EASST', 'Christmas Island Time': 'CXT', 'Cocos Islands Time': 'CCT',
  'Falkland Islands Standard Time': 'FKT', 'South Georgia Time': 'GST', 'French Southern & Antarctic Time': 'TFT', 'Davis Time': 'DAVT',
  'Dumont d’Urville Time': 'DDUT', 'Mawson Time': 'MAWT', 'Rothera Time': 'ROTT', 'Syowa Time': 'SYOT', 'Vostok Time': 'VOST',
};

export const CODE_BY_ZONE = {
  'Europe/Guernsey': 'Europe/London', 'Europe/Jersey': 'Europe/London', 'Europe/Isle_of_Man': 'Europe/London',
  'America/Punta_Arenas': 'CLST', 'America/Coyhaique': 'CLST', 'Antarctica/Palmer': 'CLST',   // Magallanes stays on summer time all year
  'Antarctica/Troll': 'Europe/Berlin', 'Asia/Amman': 'AST', 'Asia/Damascus': 'AST',          // Jordan and Syria moved to UTC+3 for good
  'Asia/Urumqi': 'XJT', 'Pacific/Bougainville': 'BST',
};
