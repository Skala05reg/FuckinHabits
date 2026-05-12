import { InlineKeyboard } from "grammy";

interface MiniAppLink {
  label: string;
  url: string;
  allowedUserIds?: Set<string>;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readIdSet(value: string | undefined) {
  const ids = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return ids.length ? new Set(ids) : undefined;
}

function canShowLink(link: MiniAppLink, telegramId: number | string | undefined) {
  if (!link.allowedUserIds) {
    return true;
  }

  return telegramId != null && link.allowedUserIds.has(String(telegramId));
}

export function getPrimaryMiniAppUrl() {
  return readEnv("WEBAPP_URL");
}

export function getStartMiniAppLinks(telegramId: number | string | undefined) {
  const links: MiniAppLink[] = [];
  const primaryUrl = getPrimaryMiniAppUrl();
  const pmwAdminUrl = readEnv("PMW_ADMIN_WEBAPP_URL");

  if (primaryUrl) {
    links.push({
      label: readEnv("WEBAPP_LABEL") ?? "Открыть трекер",
      url: primaryUrl,
    });
  }

  if (pmwAdminUrl) {
    links.push({
      label: readEnv("PMW_ADMIN_WEBAPP_LABEL") ?? "Панель PMW",
      url: pmwAdminUrl,
      allowedUserIds: readIdSet(
        readEnv("PMW_ADMIN_TELEGRAM_IDS") ?? readEnv("TELEGRAM_ADMIN_IDS")
      ),
    });
  }

  return links.filter((link) => canShowLink(link, telegramId));
}

export function buildMiniAppKeyboard(links: MiniAppLink[]) {
  const keyboard = new InlineKeyboard();

  links.forEach((link, index) => {
    keyboard.webApp(link.label, link.url);
    if (index < links.length - 1) {
      keyboard.row();
    }
  });

  return keyboard;
}
