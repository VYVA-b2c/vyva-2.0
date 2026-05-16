import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ResponsiveGridColumns = "one" | "two" | "three" | "four" | "auto";

const columnClasses: Record<ResponsiveGridColumns, string> = {
  one: "grid-cols-1",
  two: "grid-cols-1 sm:grid-cols-2",
  three: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  four: "grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4",
  auto: "grid-cols-[repeat(auto-fit,minmax(min(100%,168px),1fr))]",
};

type ResponsiveGridProps = HTMLAttributes<HTMLDivElement> & {
  columns?: ResponsiveGridColumns;
  gap?: "sm" | "md" | "lg";
};

export function ResponsiveGrid({
  columns = "two",
  gap = "md",
  className,
  ...props
}: ResponsiveGridProps) {
  return (
    <div
      className={cn(
        "grid",
        columnClasses[columns],
        gap === "sm" && "gap-3",
        gap === "md" && "gap-4",
        gap === "lg" && "gap-5",
        className,
      )}
      {...props}
    />
  );
}
