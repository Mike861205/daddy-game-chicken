type InstallOutcome = 'accepted' | 'dismissed' | 'installed' | 'unavailable';
type NotificationOutcome =
  | NotificationPermission
  | 'install-first'
  | 'unsupported'
  | 'error';
type PwaPlatform = 'android' | 'ios' | 'desktop';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

interface PeriodicSyncManager {
  register(tag: string, options: { minInterval: number }): Promise<void>;
}

interface ServiceWorkerRegistrationWithPeriodicSync extends ServiceWorkerRegistration {
  periodicSync?: PeriodicSyncManager;
}

export interface PwaState {
  installed: boolean;
  runningStandalone: boolean;
  canPromptInstall: boolean;
  platform: PwaPlatform;
  installOutcome: InstallOutcome | null;
  notificationPermission: NotificationPermission | 'unsupported';
  periodicRemindersEnabled: boolean;
}

const INSTALLED_KEY = 'daddy-pollo-pwa-installed';
const REMINDERS_KEY = 'daddy-pollo-reminders-enabled';
const REMINDER_TAG = 'daddy-pollo-play-reminder';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class PwaManager {
  private initialized = false;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private installOutcome: InstallOutcome | null = null;
  private listeners = new Set<(state: PwaState) => void>();

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredInstallPrompt = event as BeforeInstallPromptEvent;
      this.installOutcome = null;
      this.emit();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      this.installOutcome = 'installed';
      this.safeStorageSet(INSTALLED_KEY, 'true');
      this.emit();
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener(
        'load',
        () => {
          const workerUrl = `/sw.js?v=${encodeURIComponent(__PWA_VERSION__)}`;
          void navigator.serviceWorker
            .register(workerUrl, { updateViaCache: 'none' })
            .then((registration) => registration.update())
            .catch((error: unknown) => {
              console.warn(
                'No se pudo registrar el modo PWA:',
                error instanceof Error ? error.message : 'error desconocido',
              );
            });
        },
        { once: true },
      );
    }
  }

  getState(): PwaState {
    const runningStandalone = this.isRunningStandalone();
    return {
      installed:
        runningStandalone ||
        this.installOutcome === 'accepted' ||
        this.installOutcome === 'installed' ||
        this.safeStorageGet(INSTALLED_KEY) === 'true',
      runningStandalone,
      canPromptInstall: this.deferredInstallPrompt !== null,
      platform: this.detectPlatform(),
      installOutcome: this.installOutcome,
      notificationPermission:
        'Notification' in window ? Notification.permission : 'unsupported',
      periodicRemindersEnabled: this.safeStorageGet(REMINDERS_KEY) === 'true',
    };
  }

  subscribe(listener: (state: PwaState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  async promptInstall(): Promise<InstallOutcome> {
    if (this.getState().installed) {
      this.installOutcome = 'installed';
      this.emit();
      return 'installed';
    }

    const prompt = this.deferredInstallPrompt;
    if (!prompt) {
      this.installOutcome = 'unavailable';
      this.emit();
      return 'unavailable';
    }

    // A BeforeInstallPromptEvent can only be used once.
    this.deferredInstallPrompt = null;
    const result = await prompt.prompt();
    this.installOutcome = result.outcome;
    if (result.outcome === 'accepted') {
      this.safeStorageSet(INSTALLED_KEY, 'true');
    }
    this.emit();
    return result.outcome;
  }

  async requestNotifications(): Promise<NotificationOutcome> {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return 'unsupported';
    }

    const state = this.getState();
    if (state.platform === 'ios' && !state.runningStandalone) {
      return 'install-first';
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.emit();
        return permission;
      }

      const registration =
        (await navigator.serviceWorker.ready) as ServiceWorkerRegistrationWithPeriodicSync;

      await registration.showNotification('Recordatorios activados', {
        body: 'Las notificaciones de Daddy Pollo quedaron permitidas en este dispositivo.',
        icon: '/assets/icons/daddy-pollo-pwa-192.png',
        badge: '/assets/icons/daddy-pollo-pwa-192.png',
        tag: 'daddy-pollo-notifications-enabled',
      });

      if (registration.periodicSync) {
        await registration.periodicSync.register(REMINDER_TAG, {
          minInterval: ONE_DAY_MS,
        });
        this.safeStorageSet(REMINDERS_KEY, 'true');
      } else {
        this.safeStorageRemove(REMINDERS_KEY);
      }

      this.emit();
      return permission;
    } catch {
      return 'error';
    }
  }

  private detectPlatform(): PwaPlatform {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIPadDesktopMode =
      navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    if (/iphone|ipad|ipod/u.test(userAgent) || isIPadDesktopMode) {
      return 'ios';
    }
    if (/android/u.test(userAgent)) {
      return 'android';
    }
    return 'desktop';
  }

  private isRunningStandalone(): boolean {
    const iosNavigator = navigator as Navigator & { standalone?: boolean };
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      iosNavigator.standalone === true
    );
  }

  private emit(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  private safeStorageGet(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeStorageSet(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private browsing can deny storage without affecting installation.
    }
  }

  private safeStorageRemove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Private browsing can deny storage without affecting installation.
    }
  }
}

export const pwaManager = new PwaManager();
