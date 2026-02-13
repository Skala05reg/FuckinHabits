function envInt(
  name: string,
  fallback: number,
  opts?: {
    min?: number;
    max?: number;
  },
): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;

  if (opts?.min !== undefined && parsed < opts.min) return fallback;
  if (opts?.max !== undefined && parsed > opts.max) return fallback;

  return Math.trunc(parsed);
}

function envFloat(
  name: string,
  fallback: number,
  opts?: {
    min?: number;
    max?: number;
  },
): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;

  if (opts?.min !== undefined && parsed < opts.min) return fallback;
  if (opts?.max !== undefined && parsed > opts.max) return fallback;

  return parsed;
}

export const APP_CONFIG = {
  logicalDayStartHour: envInt("LOGICAL_DAY_START_HOUR", 4, { min: 0, max: 23 }),
  defaultDigestTime: process.env.DEFAULT_DIGEST_TIME ?? "09:00",
  tzOffsetLimitMinutes: envInt("TZ_OFFSET_LIMIT_MINUTES", 14 * 60, { min: 0, max: 24 * 60 }),
  defaultCalendarTimeZone: process.env.CALENDAR_TIMEZONE ?? "Europe/Moscow",
  defaultCalendarOffsetMinutes: envInt("CALENDAR_DEFAULT_OFFSET_MINUTES", 180, {
    min: -14 * 60,
    max: 14 * 60,
  }),
  cronUsersBatchLimit: envInt("CRON_USERS_BATCH_LIMIT", 5000, { min: 1, max: 20_000 }),
  cronMinuteTolerance: envInt("CRON_MINUTE_TOLERANCE", 5, { min: 0, max: 30 }),
  cronProcessBatchSize: envInt("CRON_PROCESS_BATCH_SIZE", 25, { min: 1, max: 500 }),
  remindMissingLookbackDays: envInt("REMIND_MISSING_LOOKBACK_DAYS", 7, { min: 1, max: 30 }),
  telegramButtonTextLimit: envInt("TELEGRAM_BUTTON_TEXT_LIMIT", 40, { min: 10, max: 128 }),
  telegramButtonTextTruncateTo: envInt("TELEGRAM_BUTTON_TEXT_TRUNCATE_TO", 37, { min: 5, max: 127 }),
  notesDefaultPageSize: envInt("NOTES_DEFAULT_PAGE_SIZE", 10, { min: 1, max: 50 }),
  notesMaxPageSize: envInt("NOTES_MAX_PAGE_SIZE", 50, { min: 1, max: 200 }),
  llmClassifierMaxTokens: envInt("LLM_CLASSIFIER_MAX_TOKENS", 1024, { min: 128, max: 4096 }),
  llmAgentMaxTokens: envInt("LLM_AGENT_MAX_TOKENS", 512, { min: 128, max: 4096 }),
  llmClassifierTemperature: envFloat("LLM_CLASSIFIER_TEMPERATURE", 0.1, { min: 0, max: 1 }),
  llmAgentTemperature: envFloat("LLM_AGENT_TEMPERATURE", 0, { min: 0, max: 1 }),
} as const;
