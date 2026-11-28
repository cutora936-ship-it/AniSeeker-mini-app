import { accountKeys, normalizeValue } from '../shared/account-keys.mjs';

export function parseChanges(changes) {
  if (!Array.isArray(changes) || !changes.length || changes.length > accountKeys.size) return null;
  const seen = new Set();
  const valid = [];
  for (const change of changes) {
    if (!change || typeof change.key !== 'string' || seen.has(change.key)
      || !Number.isInteger(change.version) || change.version < 0 || change.version >= 2147483647
      || typeof change.mutation !== 'string' || !/^[a-f0-9-]{36}$/.test(change.mutation)) return null;
    const value = normalizeValue(change.key, change.value);
    if (value === null) return null;
    seen.add(change.key);
    valid.push({ key: change.key, group: accountKeys.get(change.key), value, version: change.version, mutation: change.mutation });
  }
  return valid;
}
