import { Router } from "express";
import { db } from "../db/index.js";
import { categories } from "../db/schema.js";

const router = Router();

// GET /api/categories
router.get("/", async (req, res) => {
  try {
    const result = await db.select().from(categories);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("categories:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch categories" });
  }
});

export default router;
