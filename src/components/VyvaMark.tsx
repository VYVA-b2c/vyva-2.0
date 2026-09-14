import markPurple from "@/assets/brand/vyva-mark-purple.svg";
import markWhite from "@/assets/brand/vyva-mark-white.svg";

type VyvaMarkProps = {
  className?: string;
  variant?: "purple" | "white";
};

export function VyvaMark({
  className = "h-8 w-8",
  variant = "purple",
}: VyvaMarkProps) {
  return (
    <img
      src={variant === "white" ? markWhite : markPurple}
      alt="VYVA"
      className={className}
    />
  );
}
