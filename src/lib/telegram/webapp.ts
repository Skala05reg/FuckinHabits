export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
};

export function getTelegramWebApp(): TelegramWebApp | null {
  const w = globalThis as unknown as {
    Telegram?: { WebApp?: TelegramWebApp };
  };
  return w.Telegram?.WebApp ?? null;
}
