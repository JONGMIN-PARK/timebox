import { Router } from "express";
import { db } from "../db/index.js";
import { categories } from "../db/schema.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const router = Router();

let categoryCache: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// GET /api/categories
router.get("/", asyncHandler(async (req, res) => {
  if (categoryCache && Date.now() - cacheTime < CACHE_TTL) {
    res.json({ success: true, data: categoryCache });
    return;
  }
  const data = await db.select().from(categories);
  categoryCache = data;
  cacheTime = Date.now();
  res.json({ success: true, data });
}));

export default router;
