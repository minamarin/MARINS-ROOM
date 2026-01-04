import { env } from "../config/env.js";
import { logger } from "./logger.js";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AIResponse {
  content: string;
  error?: string;
}

const SYSTEM_PROMPT = `You are Marin's AI assistant on their personal website "Marin's Room". You are friendly, helpful, and conversational. You can help visitors learn more about Marin, answer questions about the website, or just have a pleasant chat.

Keep your responses concise but warm. If asked about personal details you don't know, politely explain that you're an AI assistant and suggest they reach out to Marin directly.

Never share sensitive information or make up facts about Marin. Be helpful, positive, and engaging.`;

export async function getAIResponse(
  messages: ChatMessage[]
): Promise<AIResponse> {
  try {
    const response = await fetch(`${env.AI_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("AI API error:", error);
      return {
        content: "",
        error: "Failed to get AI response",
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        content: "",
        error: "Empty AI response",
      };
    }

    return { content };
  } catch (error) {
    logger.error("AI request failed:", error);
    return {
      content: "",
      error: "AI service unavailable",
    };
  }
}
