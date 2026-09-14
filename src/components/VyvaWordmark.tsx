import logoGradient from "@/assets/brand/vyva-wordmark-gradient.svg";
import logoPurple from "@/assets/brand/vyva-wordmark-purple.svg";
import logoWhite from "@/assets/brand/vyva-wordmark-white.svg";

type VyvaWordmarkProps = {
  className?: string;
  variant?: "purple" | "white" | "gradient";
};

const LOGO_BY_VARIANT = {
  gradient: logoGradient,
  purple: logoPurple,
  white: logoWhite,
} as const;

export function VyvaWordmark({
  className = "h-auto w-[106px] sm:w-[136px]",
  variant = "purple",
}: VyvaWordmarkProps) {
  return (
    <img
      src={LOGO_BY_VARIANT[variant]}
      alt="VYVA"
      className={className}
    />
  );
}
