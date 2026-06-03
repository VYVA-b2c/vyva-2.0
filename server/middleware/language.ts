import type { NextFunction, Request, Response } from "express";
import { normalizeAppLanguage } from "../../shared/language.js";

declare global {
  namespace Express {
    interface Request {
      language?: string;
      languageSource?: string;
    }
  }
}

function normalizeRequestLanguage(value: unknown): string {
  return typeof value === "string" ? normalizeAppLanguage(value, "es") : "es";
}

export function languageMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.language = normalizeRequestLanguage(req.get("x-vyva-language"));
  req.languageSource = req.get("x-vyva-language-source")?.trim() || "unknown";
  next();
}
