import { google } from "googleapis";

function getAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
    }
    return undefined;
  }
  try {
    const credentials = JSON.parse(json);
    return new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  } catch (e) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON");
      }
      console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON", e);
      return undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCalendar = () => google.calendar({ version: "v3", auth: getAuth() as any });

export const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
