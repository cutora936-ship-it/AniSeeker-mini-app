// Operator-only DevTools snippet. Set this only after independently verifying the legacy owner's Telegram ID.
(async () => {
  const verifiedOwnerId = 0;

  function checkOwner() {
    if (!Number.isSafeInteger(verifiedOwnerId) || verifiedOwnerId <= 0
      || window.Telegram?.WebApp?.initDataUnsafe?.user?.id !== verifiedOwnerId) {
      throw new Error('ID подтверждённого владельца должен совпадать с ID открытого аккаунта.');
    }
  }

  checkOwner();
  const scope = `telegram:${verifiedOwnerId}`;
  const profile = 'profile:v1';
  const keys = [
    'favorites:v1', 'observation-match:v1', 'mastermind:v1', 'strategy:v1', 'body-language:v1',
    'communication:v1', 'communication:sound', 'stroop:records:v1', 'stroop:sound:v1', profile,
  ];
  const destination = (key) => `aniseeker:user:${scope}:${key}`;
  const legacy = keys.flatMap((key) => {
    const value = localStorage.getItem(`aniseeker:${key}`);
    return value === null ? [] : [{ key, value }];
  });
  if (!legacy.length) return { copied: 0, kept: 0 };

  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('aniseeker-profile', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('avatars');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let profileAvailable = true;
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('avatars', 'readwrite');
      const store = transaction.objectStore('avatars');
      const marker = ['recovery', 'legacy-owner:v1'];
      const request = store.get(marker);
      let failure;
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(failure ?? transaction.error);
      const abort = (message) => {
        failure = new Error(message);
        transaction.abort();
      };

      request.onsuccess = () => {
        if (request.result !== undefined && request.result !== scope) {
          abort('Старые данные уже закреплены за другим владельцем.');
          return;
        }
        const entry = legacy.find(({ key }) => key === profile);
        let avatarId;
        if (entry && localStorage.getItem(destination(profile)) === null) {
          try {
            const parsed = JSON.parse(entry.value);
            if (!parsed || typeof parsed !== 'object') throw new Error();
            avatarId = typeof parsed.avatarId === 'string' ? parsed.avatarId : null;
          } catch {
            profileAvailable = false;
          }
        }

        store.put(scope, marker);
        if (!avatarId) return;
        const avatar = store.get(avatarId);
        avatar.onsuccess = () => {
          const value = avatar.result;
          if (!(value?.bytes instanceof ArrayBuffer) || typeof value.type !== 'string') {
            // Restore the nickname even if the old image is unavailable.
            entry.value = JSON.stringify({ ...JSON.parse(entry.value), avatarId: null });
            return;
          }
          const target = [scope, avatarId];
          const existing = store.getKey(target);
          existing.onsuccess = () => {
            if (existing.result === undefined) store.add(value, target);
          };
        };
      };
    });
  } finally {
    database.close();
  }

  checkOwner();
  let copied = 0;
  for (const { key, value } of legacy) {
    const target = destination(key);
    if ((key === profile && !profileAvailable) || localStorage.getItem(target) !== null) continue;
    localStorage.setItem(target, value);
    copied++;
  }
  return { copied, kept: legacy.length - copied };
})();
