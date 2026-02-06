import Anthropic from "@anthropic-ai/sdk";

export const llm = new Anthropic({
  apiKey: process.env.GLM_API_KEY || "dummy-key",
  baseURL: "https://api.z.ai/api/anthropic", 
});

export const GLM_MODEL = process.env.GLM_MODEL || "glm-4.7";
