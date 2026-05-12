import { InlineKeyboard } from "grammy";

interface MiniAppLink {
  label: string;
  url: string;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getPrimaryMiniAppUrl() {
  return readEnv("WEBAPP_URL");
}

export function getStartMiniAppLinks() {
  const links: MiniAppLink[] = [];
  const primaryUrl = getPrimaryMiniAppUrl();
  const pmwAdminUrl = readEnv("PMW_ADMIN_WEBAPP_URL");

  if (primaryUrl) {
    links.push({
      label: readEnv("WEBAPP_LABEL") ?? "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0442\u0440\u0435\u043a\u0435\u0440",
      url: primaryUrl,
    });
  }

  if (pmwAdminUrl) {
    links.push({
      label: readEnv("PMW_ADMIN_WEBAPP_LABEL") ?? "\u041f\u0430\u043d\u0435\u043b\u044c PMW",
      url: pmwAdminUrl,
    });
  }

  return links;
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
