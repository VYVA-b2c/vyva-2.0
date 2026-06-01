import type { NextFunction, Request, Response } from "express";

const SUPPORTED_REQUEST_LANGUAGES = new Set(["es", "en", "fr", "de", "it", "pt", "cy"]);

declare global {
  namespace Express {
    interface Request {
      language?: string;
      languageSource?: string;
    }
  }
}

function normalizeRequestLanguage(value: unknown): string {
  if (typeof value !== "string") return "es";
  const language = value.trim().toLowerCase().split("-")[0];
  return SUPPORTED_REQUEST_LANGUAGES.has(language) ? language : "es";
}

export function languageMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.language = normalizeRequestLanguage(req.get("x-vyva-language"));
  req.languageSource = req.get("x-vyva-language-source")?.trim() || "unknown";
  next();
}
