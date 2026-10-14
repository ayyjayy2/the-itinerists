/**
 * "What's an eSIM?" on Tips & Recs (#474): plain words for people who have
 * never heard of one, so they feel safe tapping a link. Short sentences, one
 * idea each; no jargon without saying what it means.
 */
export interface GuideStep { title: string; text: string; }

export const ESIM_INTRO =
  'An eSIM is a way to get internet on your phone in another country, without swapping any cards ' +
  'and without your carrier\'s roaming fees. You buy it in an app, and your phone adds it like a second line.';

export const ESIM_STEPS: readonly GuideStep[] = [
  { title: 'Pick a plan before you go',
    text: 'Open one of the apps above, search for the country you\'re visiting, and choose how much data you want. ' +
          'For a week of maps, messages and photos, 3 GB is usually plenty. Get more if you\'ll stream video.' },
  { title: 'Install it at home, on Wi-Fi',
    text: 'The app walks you through it in a few taps, about 5 minutes. Nothing is removed from your phone, ' +
          'and the plan doesn\'t start until you arrive.' },
  { title: 'Switch it on when you land',
    text: 'In Settings → Cellular (Mobile Data on some phones), choose the eSIM for data and turn on Data Roaming for it. ' +
          'Turn Data Roaming off for your usual line, so your carrier doesn\'t charge you. The app shows you exactly where.' },
  { title: 'That\'s it',
    text: 'Maps, messages and photos work like at home. Your usual number stays on your phone for texts and iMessage.' },
];

export const ESIM_GOOD_TO_KNOW: readonly string[] = [
  'Most phones from the last few years work: iPhone XS or newer, and most recent Android phones. ' +
    'Quick check on an iPhone: open Settings → Cellular. If you see "Add eSIM", you\'re set.',
  'Your phone needs to be unlocked, meaning not tied to one carrier. Most are once they\'re paid off.',
  'Calls to your usual number may still cost extra abroad, so use WhatsApp or FaceTime for calls.',
  'Back home, switch your data back to your usual line. You can delete the eSIM, or keep it for your next trip.',
];
