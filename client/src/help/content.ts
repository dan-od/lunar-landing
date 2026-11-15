// Plain-language help: one-sentence definitions for the "?" beside each term,
// and a page of help per tab (what it answers, three steps, what each number
// means). No jargon: written for someone who has never planned a landing.

export type TermId = 'margin' | 'accuracy' | 'power' | 'link' | 'slip' | 'miss';

export const TERMS: Record<TermId, { word: string; text: string }> = {
  margin: {
    word: 'Margin',
    text: 'How many degrees above a flat horizon the Sun or Earth must be before it counts, to allow for hills the smooth-Moon model cannot see.',
  },
  accuracy: {
    word: 'Accuracy',
    text: 'How far from its aim the lander might come down: within 100, 250 or 320 metres.',
  },
  power: {
    word: 'Power up',
    text: 'The share of the 30 days after landing when the Sun is high enough to light the solar panels.',
  },
  link: {
    word: 'Link up',
    text: 'The share of the 30 days after landing when Earth is high enough in the sky for radio contact.',
  },
  slip: {
    word: 'Slip',
    text: 'Moving the landing date by whole days, as happens when a launch is delayed.',
  },
  miss: {
    word: 'Miss',
    text: 'Landing away from the aim; the Miss tab counts how many landings out of 10 would still work on real terrain.',
  },
};

export interface TabHelp {
  title: string;
  answers: string;
  steps: [string, string, string];
  numbers: Array<{ name: string; meaning: string }>;
  note?: string;
}

export const TAB_HELP: Record<string, TabHelp> = {
  '/': {
    title: 'Console',
    answers:
      'Would a lander at this place, landing at this time, have sunlight for power and Earth in view to talk home, and for how much of the next 30 days?',
    steps: [
      'Pick a place from the list on the left or a pin on the map.',
      'Set the landing date and hour in the bar at the top (all times are UTC), or press Now.',
      'Drag the slider under the map, or press Play, to move through the 30 days after landing.',
    ],
    numbers: [
      { name: 'Ready, No power, No link, Dark', meaning: 'Whether the Sun and Earth are both up at the moment shown. Each has its own symbol, so colour is never needed.' },
      { name: 'Sun height and Earth height', meaning: 'How many degrees each sits above the horizon. Below zero means it is out of sight.' },
      { name: 'Power up', meaning: TERMS.power.text },
      { name: 'Link up', meaning: TERMS.link.text },
      { name: 'Next change', meaning: 'How long after landing the Sun or Earth next rises or sets.' },
      { name: 'Margin', meaning: TERMS.margin.text },
    ],
    note: 'Positions come from NASA JPL Horizons. The Moon is treated as smooth except on the Miss tab, where real terrain is used.',
  },
  '/compare': {
    title: 'Compare',
    answers: 'Which of two landing plans is better, and in what ways?',
    steps: [
      'Choose a quick setup, such as the same place 10 days later, or set each side by hand.',
      'Set the place, date and hour on side A and side B.',
      'Read the change report on the right, and copy it to pass on.',
    ],
    numbers: [
      { name: 'Verdict', meaning: 'Which side comes out ahead overall, or "No meaningful change" when nothing differs.' },
      { name: 'Power up and Link up', meaning: 'The share of the 30 days with sunlight, and with Earth in view, on each side.' },
      { name: 'Longest dark', meaning: 'The longest stretch without sunlight, in days.' },
      { name: 'Longest gap', meaning: 'The longest stretch without Earth in view, in days.' },
      { name: 'Better, worse, same', meaning: 'Each line of the report says how side B differs from side A.' },
    ],
  },
  '/miss': {
    title: 'Miss',
    answers:
      'If the lander comes down away from its aim, how many landings out of 10 would still work, and is there a safer place to aim?',
    steps: [
      'Look at the map: light ground works, dark ground is in shadow.',
      'Click the map, or use the arrow buttons, to move the aim. The rings and numbers follow.',
      'Press "Move to the safest spot" to try the best nearby aim, then use it on another tab.',
    ],
    numbers: [
      { name: 'Out of 10', meaning: 'Of landings spread evenly inside a ring, how many would have sunlight and Earth in view at touchdown and for most of the first 10 days.' },
      { name: 'Rings', meaning: 'How far a lander might miss: 100, 250 or 320 metres. The solid ring is the accuracy chosen in Settings.' },
      { name: 'Accuracy', meaning: TERMS.accuracy.text },
    ],
    note: 'Terrain comes from NASA’s LOLA south pole elevation map, 80 m per pixel, and is prepared for the IM-2 target only.',
  },
  '/watch': {
    title: 'Watch',
    answers: 'When will the Sun and Earth next rise and set at your landing site, and can you be reminded?',
    steps: [
      'Choose the place and landing time in the bar at the top or on the Console.',
      'Read the list of sunrises, sunsets, Earth rises and Earth sets for the next 30 days.',
      'Add one change, or all of them, to your calendar with a reminder.',
    ],
    numbers: [
      { name: 'Sunrise and sunset', meaning: 'When the Sun climbs above the margin, or drops below it, at that place.' },
      { name: 'Earth rise and Earth set', meaning: 'When Earth comes into view for radio contact, or goes out of view.' },
      { name: 'Times', meaning: 'All in UTC, to the hour, because NASA’s positions are hourly.' },
    ],
  },
  '/api': {
    title: 'API',
    answers: 'How can a program, or an AI assistant, get the same answers as these pages?',
    steps: [
      'Pick an endpoint from the list.',
      'Press Send to call it for real with the current place and date.',
      'Copy the address into your own code or the command line.',
    ],
    numbers: [
      { name: 'model', meaning: 'Every reply says whether it used the smooth-Moon model or real terrain.' },
      { name: 'saved', meaning: 'True when the answer came from positions already saved, without asking NASA again.' },
      { name: 'Limits', meaning: 'Each visitor may make a set number of requests a minute; too many returns a wait time.' },
    ],
  },
};

export interface TourStep {
  /** CSS selector of the part of the page this step points at. */
  target: string;
  title: string;
  text: string;
}

export const TOUR: TourStep[] = [
  {
    target: '#sites-title',
    title: 'Places to land',
    text: 'Each row is a place a lander could touch down. The word on the right says whether it would work at the landing moment.',
  },
  {
    target: '.scn-when',
    title: 'When it lands',
    text: 'Set the landing date and hour here, in UTC, or press Now. The −1 d, +1 d and +10 d buttons move the date.',
  },
  {
    target: '.tl',
    title: 'The next 30 days',
    text: 'Yellow bars are sunlight for power; blue bars are Earth in view for contact. Drag the slider or press Play.',
  },
  {
    target: '#insp-title',
    title: 'The details',
    text: 'The numbers for the chosen place at the moment on the slider. Help, at the top, explains each one.',
  },
];

export const TOUR_KEY = 'moon:tour';
