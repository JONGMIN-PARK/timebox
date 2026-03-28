import { LINK_CODE_EXPIRY } from "./constants.js";

export const linkCodes = new Map<string, { userId: number; createdAt: number }>();

// Clean expired codes (call periodically)
export function cleanExpiredCodes() {
  const now = Date.now();
  for (const [code, data] of linkCodes.entries()) {
    if (now - data.createdAt > LINK_CODE_EXPIRY) linkCodes.delete(code);
  }
}
