import { useEffect, useState } from "react";

export type ReadableTextSize = "normal" | "large";

export const READABLE_TEXT_SIZE_STORAGE_KEY = "vyva:readable-text-size:v1";
export const READABLE_TEXT_SIZE_CHANGED_EVENT = "vyva:readable-text-size-changed";

function isReadableTextSize(value: string | null): value is ReadableTextSize {
  return value === "normal" || value === "large";
}

export function readReadableTextSize(): ReadableTextSize {
  if (typeof window === "undefined") return "large";

  try {
    const stored = window.localStorage.getItem(READABLE_TEXT_SIZE_STORAGE_KEY);
    return isReadableTextSize(stored) ? stored : "large";
  } catch {
    return "large";
  }
}

export function writeReadableTextSize(size: ReadableTextSize) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(READABLE_TEXT_SIZE_STORAGE_KEY, size);
    window.dispatchEvent(new CustomEvent(READABLE_TEXT_SIZE_CHANGED_EVENT, { detail: { size } }));
  } catch {
    // Readability remains a convenience preference if browser storage is unavailable.
  }
}

export function useReadableTextSize() {
  const [size, setSize] = useState<ReadableTextSize>(() => readReadableTextSize());

  useEffect(() => {
    const syncSize = () => setSize(readReadableTextSize());
    window.addEventListener("storage", syncSize);
    window.addEventListener(READABLE_TEXT_SIZE_CHANGED_EVENT, syncSize);
    return () => {
      window.removeEventListener("storage", syncSize);
      window.removeEventListener(READABLE_TEXT_SIZE_CHANGED_EVENT, syncSize);
    };
  }, []);

  const nextSize: ReadableTextSize = size === "large" ? "normal" : "large";

  return {
    size,
    isLarge: size === "large",
    setSize: writeReadableTextSize,
    toggleSize: () => writeReadableTextSize(nextSize),
  };
}
