import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { learningLessonImages } from "../../shared/schema.js";

export async function learningImageHandler(req: Request, res: Response) {
  try {
    const [image] = await db
      .select()
      .from(learningLessonImages)
      .where(eq(learningLessonImages.id, req.params.id))
      .limit(1);

    if (!image) return res.status(404).send("Image not found");

    res.setHeader("Content-Type", image.mimeType || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(Buffer.from(image.imageBytes));
  } catch (error) {
    console.error("[learning] generated image load failed:", error);
    return res.status(500).send("Image could not be loaded");
  }
}
