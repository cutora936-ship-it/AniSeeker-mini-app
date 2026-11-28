import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { getTelegram } from '../platform/telegram';
import { readAvatar } from '../profile/storage';
import { cloudEnabled, createCloudAccount, type CloudAccount } from './sync';
import { createUserStorage, telegramScope, type UserScope, type UserStorage } from './storage';

type Account = {
  scope: UserScope;
  storage: UserStorage;
  loadAvatar: (id: string) => Promise<Blob | null>;
  cloud?: CloudAccount;
  authorized?: boolean;
  canImport?: boolean;
};

const context = createContext<Account | null>(null);
const events = ['focus', 'pageshow', 'hashchange'] as const;

function getScope(): UserScope | 'loading' | 'unavailable' {
  const app = getTelegram();
  const launch = new URLSearchParams(window.location.hash.slice(1));
  const launchData = launch.get('tgWebAppData');
  const scope = telegramScope(app?.initDataUnsafe.user?.id);
  // The SDK can still represent the previous launch if the WebView changes its URL in place.
  if (launchData && app && launchData !== app.initData) return 'unavailable';
  if (scope) return scope;

  const sdk = document.getElementById('telegram-sdk');
  const expectsUser = Boolean(
    app || launchData || window.TelegramWebviewProxy,
  );
  if (sdk?.dataset.state === 'pending' && !app) return 'loading';
  // A known Telegram launch without an ID cannot access the browser guest profile.
  return expectsUser ? 'unavailable' : 'guest';
}

function subscribe(notify: () => void) {
  const sdk = document.getElementById('telegram-sdk');
  let app: ReturnType<typeof getTelegram> = null;

  function refresh() {
    const next = getTelegram();
    if (next !== app) {
      app?.offEvent('activated', refresh);
      app = next;
      app?.onEvent('activated', refresh);
    }
    notify();
  }

  sdk?.addEventListener('load', refresh);
  sdk?.addEventListener('error', refresh);
  for (const event of events) window.addEventListener(event, refresh);
  document.addEventListener('visibilitychange', refresh);
  refresh();

  return () => {
    sdk?.removeEventListener('load', refresh);
    sdk?.removeEventListener('error', refresh);
    for (const event of events) window.removeEventListener(event, refresh);
    document.removeEventListener('visibilitychange', refresh);
    app?.offEvent('activated', refresh);
  };
}

function getLaunchData() {
  return getTelegram()?.initData ?? '';
}

function CloudProvider({ scope, initData, children }: {
  scope: Exclude<UserScope, 'guest'>;
  initData: string;
  children: ReactNode;
}) {
  const cloud = useMemo(() => createCloudAccount(scope, initData), [scope, initData]);
  const { ready, authorized, canImport, rejected } = useSyncExternalStore(cloud.subscribe, cloud.snapshot);
  useEffect(() => cloud.start(), [cloud]);

  if (!ready) return <div className="app"><p className="subscreen screen-loading" role="status">Загрузка AniSeeker…</p></div>;
  const account = { scope, cloud, storage: cloud.storage, loadAvatar: cloud.loadAvatar, authorized, canImport };
  return <context.Provider key={rejected ? 'local-session' : scope} value={account}>{children}</context.Provider>;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const scope = useSyncExternalStore(subscribe, getScope);
  const initData = useSyncExternalStore(subscribe, getLaunchData);
  const account = useMemo(() => scope === 'loading' || scope === 'unavailable' ? null
    : { scope, storage: createUserStorage(scope), loadAvatar: (id: string) => readAvatar(scope, id) }, [scope]);

  if (!account) {
    return <div className="app"><p className="subscreen screen-loading" role="status">
      {scope === 'loading' ? 'Загрузка AniSeeker…' : 'Не удалось определить аккаунт. Открой AniSeeker заново из Telegram.'}
    </p></div>;
  }

  if (cloudEnabled && account.scope !== 'guest') {
    return <CloudProvider key={account.scope} scope={account.scope} initData={initData}>{children}</CloudProvider>;
  }

  // Remount the entire app at an identity change, including open editors and games.
  return <context.Provider key={account.scope} value={account}>{children}</context.Provider>;
}

export function useAccount() {
  const account = useContext(context);
  if (!account) throw new Error('AccountProvider is required');
  return account;
}
