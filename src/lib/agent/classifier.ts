import { buildClassifierPrompt } from "@/config/agent-prompts";
import { APP_CONFIG } from "@/config/app";
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

  const prompt = buildClassifierPrompt({ today, text });

  try {
    const response = await llm.messages.create({
      model: GLM_MODEL,
      max_tokens: APP_CONFIG.llmClassifierMaxTokens,
      messages: [{ role: "user", content: prompt }],
      temperature: APP_CONFIG.llmClassifierTemperature,
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
