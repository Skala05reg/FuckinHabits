import { llm, GLM_MODEL } from "@/lib/llm";

export type Intent = "schedule_event" | "get_events" | "delete_event" | "reschedule_event" | "mark_done" | "journal" | "other";

interface ScheduleDetails {
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  description: string;
}

interface RescheduleDetails {
  searchDate?: string; // Where to look for the event (optional, e.g. "from tomorrow")
  targetDate: string; // Where to move it (e.g. "to next friday")
  targetTime?: string; // New time if specified
  description: string; // Keywords to identify the event
}

interface ClassificationResult {
  intent: Intent;
  scheduleDetails?: ScheduleDetails;
  rescheduleDetails?: RescheduleDetails;
}

export async function classifyMessage(text: string): Promise<ClassificationResult> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const prompt = `
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
    "date": "YYYY-MM-DD", // Date of the task (usually today, unless specified "done yesterday's task")
    "description": "Keywords to find the task"
  }
}

If intent is "reschedule_event":
{
  "intent": "reschedule_event",
  "rescheduleDetails": {
    "searchDate": "YYYY-MM-DD", // Date mentioned as "from X". If not mentioned, use null (bot will guess).
    "targetDate": "YYYY-MM-DD", // Date mentioned as "to Y".
    "targetTime": "HH:mm" | null, // New time if mentioned.
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

// ... other intents (get_events, delete_event like before) ...

For date parsing:
- "tomorrow" -> next day.
- "after tomorrow" (послезавтра) -> day after next day.

IMPORTANT: Return ONLY valid JSON.
`;

  try {
    const response = await llm.messages.create({
      model: GLM_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    // Handle ContentBlock (which can be text or tool_use, though we only expect text here)
    const block = response.content[0];
    const content = block.type === 'text' ? block.text.trim() : "";
    
    if (!content) return { intent: "journal" };

    // Strip markdown code blocks if present
    const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson) as ClassificationResult;
  } catch (e) {
    console.error("LLM/Classification error:", e);
    if (e instanceof Error) throw e;
    throw new Error(`LLM error: ${JSON.stringify(e)}`);
  }
}
