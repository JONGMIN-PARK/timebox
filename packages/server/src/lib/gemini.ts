import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { AppError } from "./errors.js";

/** Deprecated preview model IDs → current stable ones (mirrors notes/telegram). */
export const DEPRECATED_MODELS: Record<string, string> = {
  "gemini-2.5-pro-preview-05-06": "gemini-2.5-pro",
  "gemini-2.5-flash-preview-05-20": "gemini-2.5-flash",
  "gemini-3-pro-preview": "gemini-3.1-pro-preview",
};

/**
 * Resolve a Gemini generative model for the given user's configured aiModel.
 * Throws AppError(503) when GEMINI_API_KEY is not configured.
 */
export async function getGeminiModel(userId: number) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new AppError("AI is not configured", 503);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const rawModel = user?.aiModel || "gemini-2.0-flash";
  const modelName = DEPRECATED_MODELS[rawModel] || rawModel;
  const genAI = new GoogleGenerativeAI(geminiKey);
  return genAI.getGenerativeModel({ model: modelName });
}

/** Extract the first JSON object/array from a model response (handles ```json fences). */
export function extractJson<T = unknown>(text: string): T {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.search(/[[{]/);
  if (start > 0) s = s.slice(start);
  const lastObj = s.lastIndexOf("}");
  const lastArr = s.lastIndexOf("]");
  const end = Math.max(lastObj, lastArr);
  if (end >= 0) s = s.slice(0, end + 1);
  return JSON.parse(s) as T;
}
