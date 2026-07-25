import approvedVyvaWordmark from "@/assets/logos/vyva-final-web-purple.svg";

type VyvaWordmarkProps = {
  className?: string;
};

export function VyvaWordmark({ className = "h-auto w-[132px] sm:w-[158px]" }: VyvaWordmarkProps) {
  return (
    <img
      src={approvedVyvaWordmark}
      alt="VYVA"
      className={className}
    />
  );
}
