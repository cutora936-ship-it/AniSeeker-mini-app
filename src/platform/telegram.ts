import { useEffect, useState } from 'react';

export interface TelegramUser {
  first_name: string;
  last_name?: string;
  username?: string;
}

type Insets = Readonly<Record<'top' | 'right' | 'bottom' | 'left', number>>;

interface TelegramWebApp {
  platform: string;
  initData: string;
  initDataUnsafe: { user?: TelegramUser };
  safeAreaInset?: Insets;
  contentSafeAreaInset?: Insets;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(handler: () => void): void;
    offClick(handler: () => void): void;
  };
  isVersionAtLeast(version: string): boolean;
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes?(): void;
  onEvent(event: 'safeAreaChanged' | 'contentSafeAreaChanged', handler: () => void): void;
  offEvent(event: 'safeAreaChanged' | 'contentSafeAreaChanged', handler: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function getTelegram() {
  const app = window.Telegram?.WebApp;

  return app && (app.initData || (app.platform && app.platform !== 'unknown')) ? app : null;
}

export function useTelegram(onBack?: () => void) {
  const [app, setApp] = useState(getTelegram);

  useEffect(() => {
    if (app) return;
    const sdk = document.getElementById('telegram-sdk');
    const resolveApp = () => setApp(getTelegram());

    sdk?.addEventListener('load', resolveApp);
    resolveApp();
    return () => sdk?.removeEventListener('load', resolveApp);
  }, [app]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const updateHeight = () => root.style.setProperty('--visible-height', `${viewport.height}px`);

    updateHeight();
    viewport.addEventListener('resize', updateHeight);
    return () => {
      viewport.removeEventListener('resize', updateHeight);
      root.style.removeProperty('--visible-height');
    };
  }, []);

  useEffect(() => {
    if (!app) return;
    const root = document.documentElement;
    const directions = ['top', 'right', 'bottom', 'left'] as const;
    const updateInsets = () => {
      for (const side of directions) {
        const inset = (app.safeAreaInset?.[side] ?? 0) + (app.contentSafeAreaInset?.[side] ?? 0);
        root.style.setProperty(`--telegram-inset-${side}`, `${inset}px`);
      }
    };

    app.ready();
    app.expand();

    if (app.isVersionAtLeast('6.1')) {
      app.setBackgroundColor('#100d17');
      app.setHeaderColor(app.isVersionAtLeast('6.9') ? '#100d17' : 'bg_color');
    }

    if (app.isVersionAtLeast('7.7')) app.disableVerticalSwipes?.();
    if (app.isVersionAtLeast('8.0')) {
      updateInsets();
      app.onEvent('safeAreaChanged', updateInsets);
      app.onEvent('contentSafeAreaChanged', updateInsets);
      return () => {
        app.offEvent('safeAreaChanged', updateInsets);
        app.offEvent('contentSafeAreaChanged', updateInsets);
        for (const side of directions) root.style.removeProperty(`--telegram-inset-${side}`);
      };
    }
  }, [app]);

  useEffect(() => {
    if (!app?.isVersionAtLeast('6.1') || !onBack) return;

    app.BackButton.onClick(onBack);
    app.BackButton.show();
    return () => {
      app.BackButton.offClick(onBack);
      app.BackButton.hide();
    };
  }, [app, onBack]);

  return app?.initDataUnsafe.user;
}
