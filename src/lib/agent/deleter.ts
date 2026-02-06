import { llm, GLM_MODEL } from "@/lib/llm";

interface CalendarEvent {
  id: string;
  summary: string;
  start: string; // ISO string or time
}

export async function identifyEventsToDelete(
  userQuery: string,
  events: CalendarEvent[]
): Promise<string[]> {
  const eventsList = events
    .map((e, index) => `${index + 1}. [ID: ${e.id}] "${e.summary}" (Time: ${e.start})`)
    .join("\n");

  const prompt = `
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

  try {
    const response = await llm.messages.create({
      model: GLM_MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
    });

    const block = response.content[0];
    const content = block.type === 'text' ? block.text.trim() : "";
    
    if (!content) return [];

    const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleanJson);
    return result.ids || [];
  } catch (e) {
    console.error("Smart delete error:", e);
    return [];
  }
}
