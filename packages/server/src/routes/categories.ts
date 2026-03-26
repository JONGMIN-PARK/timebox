import { Router } from "express";
import { db } from "../db/index.js";
import { categories } from "../db/schema.js";

const router = Router();

// GET /api/categories
router.get("/", (req, res) => {
  try {
    const result = db.select().from(categories).all();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch categories" });
  }
});

export default router;
