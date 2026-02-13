import { buildModifyPrompt } from "@/config/agent-prompts";
import { APP_CONFIG } from "@/config/app";
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

  const prompt = buildModifyPrompt({ userQuery, eventsList });

  try {
    const response = await llm.messages.create({
      model: GLM_MODEL,
      max_tokens: APP_CONFIG.llmAgentMaxTokens,
      messages: [{ role: "user", content: prompt }],
      temperature: APP_CONFIG.llmAgentTemperature,
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
