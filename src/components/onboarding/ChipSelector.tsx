interface ChipSelectorProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multi?: boolean;
  className?: string;
}

export function ChipSelector({
  options,
  selected,
  onChange,
  multi = true,
  className = "",
}: ChipSelectorProps) {
  const toggle = (opt: string) => {
    if (multi) {
      onChange(
        selected.includes(opt)
          ? selected.filter((s) => s !== opt)
          : [...selected, opt]
      );
    } else {
      onChange(selected.includes(opt) ? [] : [opt]);
    }
  };

  return (
    <div
      data-testid="chip-selector"
      className={`grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 ${className}`}
    >
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            data-testid={`chip-${opt.toLowerCase().replace(/\s+/g, "-")}`}
            onClick={() => toggle(opt)}
            className={`min-h-[56px] rounded-[18px] border px-4 py-3 text-left font-body text-[16px] font-black leading-tight shadow-[0_10px_22px_rgba(53,28,87,0.05)] transition-all ${
              active
                ? "border-vyva-purple bg-vyva-purple text-white shadow-[0_14px_26px_rgba(107,33,168,0.22)]"
                : "border-[#E9DDF8] bg-white text-vyva-text-1 hover:border-vyva-purple hover:text-vyva-purple"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
