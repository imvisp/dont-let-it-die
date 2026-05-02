const ADJECTIVES = [
  'quiet', 'gentle', 'kind', 'distant', 'passing',
  'weary', 'hopeful', 'curious', 'sleepy', 'lonely',
  'restless', 'patient', 'warm', 'silent', 'humble',
];

const NOUNS = [
  'wanderer', 'traveler', 'stranger', 'drifter', 'passerby',
  'soul', 'keeper', 'dreamer', 'visitor', 'pilgrim',
  'nomad', 'seeker', 'friend', 'watcher', 'listener',
];

export function generateVisitorName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `a ${adj} ${noun}`;
}

export function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  return String.fromCodePoint(
    ...countryCode.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))
  );
}
