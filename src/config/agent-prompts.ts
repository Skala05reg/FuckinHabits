export function buildClassifierPrompt(params: { today: string; text: string }): string {
  const { today, text } = params;
  return `
You are a personal assistant.
Classify the user message into one of these intents:

1. "schedule_event": Create a NEW event/task.
2. "get_events": List tasks (e.g. "What's for today?").
3. "delete_event": Remove/delete a task.
4. "reschedule_event": Move/Reschedule an EXISTING task to a different date/time. (Keywords: "перенеси", "move", "change date", "reschedule").
5. "mark_done": The user says they completed a task. (Keywords: "сделал", "решил", "готово", "done", "finished").
6. "journal": Diary entry.
7. "other": Irrelevant.

Current Date: ${today} (YYYY-MM-DD).

User message: "${text}"

Return purely JSON.

If intent is "mark_done":
{
  "intent": "mark_done",
  "scheduleDetails": {
    "date": "YYYY-MM-DD",
    "description": "Keywords to find the task"
  }
}

If intent is "reschedule_event":
{
  "intent": "reschedule_event",
  "rescheduleDetails": {
    "searchDate": "YYYY-MM-DD",
    "targetDate": "YYYY-MM-DD",
    "targetTime": "HH:mm" | null,
    "description": "Keywords to find the task"
  }
}

If intent is "schedule_event":
{
  "intent": "schedule_event",
  "scheduleDetails": {
    "date": "YYYY-MM-DD",
    "startTime": "HH:mm" | null,
    "endTime": "HH:mm" | null,
    "description": "Event description"
  }
}

For date parsing:
- "tomorrow" -> next day.
- "after tomorrow" (послезавтра) -> day after next day.

IMPORTANT: Return ONLY valid JSON.
`;
}

export function buildModifyPrompt(params: {
  userQuery: string;
  eventsList: string;
}): string {
  const { userQuery, eventsList } = params;
  return `
You are a smart calendar assistant.
The user wants to RESCHEDULE (move) a specific event.

User Query: "${userQuery}"

Available events:
${eventsList}

Identify which event matches the user's description best.
Return a JSON object with a single "id".
If no event matches clearly, return null id.

Example: { "id": "eventId123" }

IMPORTANT: Return ONLY valid JSON.
`;
}

export function buildDeletePrompt(params: {
  userQuery: string;
  eventsList: string;
}): string {
  const { userQuery, eventsList } = params;
  return `
You are a smart calendar assistant.
The user wants to delete specific events from their schedule.

User Query: "${userQuery}"

Here are the existing events for that day:
${eventsList}

Analyze the User Query and match it against the events.
Return a JSON object containing an array of "ids" for the events that should be deleted.
If no events match the user's intent, return an empty array.

Example Response:
{ "ids": ["eventId123", "eventId456"] }

IMPORTANT: Return ONLY valid JSON.
`;
}
