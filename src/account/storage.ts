export type UserScope = 'guest' | `telegram:${number}`;
export type UserStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function telegramScope(id: unknown): UserScope | null {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? `telegram:${id}` : null;
}

export function createUserStorage(scope: UserScope): UserStorage {
  const prefix = `aniseeker:user:${scope}:`;
  const qualify = (key: string) => prefix + key.replace(/^aniseeker:/, '');
  return {
    getItem: (key) => localStorage.getItem(qualify(key)),
    setItem: (key, value) => localStorage.setItem(qualify(key), value),
  };
}
