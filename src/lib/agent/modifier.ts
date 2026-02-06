import { llm, GLM_MODEL } from "@/lib/llm";

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
}

export async function identifyEventToModify(
  userQuery: string,
  events: CalendarEvent[]
): Promise<string | null> {
  const eventsList = events
    .map((e, index) => `${index + 1}. [ID: ${e.id}] "${e.summary}" (Time: ${e.start})`)
    .join("\n");

  const prompt = `
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

  try {
    const response = await llm.messages.create({
      model: GLM_MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
    });

    const block = response.content[0];
    const content = block.type === 'text' ? block.text.trim() : "";
    if (!content) return null;

    const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleanJson);
    return result.id || null;
  } catch (e) {
    console.error("Smart modify error:", e);
    return null;
  }
}
