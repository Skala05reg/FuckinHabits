import { buildDeletePrompt } from "@/config/agent-prompts";
import { APP_CONFIG } from "@/config/app";
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

  const prompt = buildDeletePrompt({ userQuery, eventsList });

  try {
    const response = await llm.messages.create({
      model: GLM_MODEL,
      max_tokens: APP_CONFIG.llmAgentMaxTokens,
      messages: [{ role: "user", content: prompt }],
      temperature: APP_CONFIG.llmAgentTemperature,
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
