const groups = {
  profile: ['profile:v1'],
  favorites: ['favorites:v1'],
  records: ['mastermind:v1', 'observation-match:v1', 'body-language:v1', 'stroop:records:v1'],
  training: ['strategy:v1', ...['strategy', 'mastermind', 'match', 'body-language', 'stroop', 'communication'].map(game => `training:${game}:v1`)],
  story: ['communication:v1'],
  settings: ['stroop:sound:v1', 'communication:sound'],
};
export const accountKeys = new Map(Object.entries(groups).flatMap(([group, names]) => names.map(key => [key, group])));

export const avatarIdPattern = /^[a-f0-9]{32}$/;

export function normalizeValue(key, value) {
  if (typeof value !== 'string' || new TextEncoder().encode(value).length > 196608) return null;
  const group = accountKeys.get(key);
  if (!group) return null;
  if (group === 'settings') return value === 'off' || value === 'on' ? value : null;
  try {
    const decoded = JSON.parse(value);
    if (group === 'profile') {
      if (typeof decoded?.nickname !== 'string'
        || (decoded.avatarId !== null && (typeof decoded.avatarId !== 'string' || !avatarIdPattern.test(decoded.avatarId)))) return null;
      const nickname = decoded.nickname.trim().normalize('NFC');
      return [...nickname].length >= 2 && [...nickname].length <= 24
        ? JSON.stringify({ nickname, avatarId: decoded.avatarId }) : null;
    }
    if (group === 'favorites') {
      return Array.isArray(decoded) && decoded.length <= 100
        && decoded.every(id => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id)) ? value : null;
    }
    if (decoded === null) return key.startsWith('training:') ? value : null;
    return typeof decoded === 'object' && !Array.isArray(decoded) ? value : null;
  } catch {
    return null;
  }
}
