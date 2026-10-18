import { useEffect, useRef, useState, type ReactNode } from "react";
import { Car, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import type { CareFinderResultOption } from "../../../shared/careFinder/search";
import type { CareFinderCopy } from "./copy";
import { ActionButton, Notice, actionClass } from "./parts";

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function ConfirmCallDialog({ name, phone, copy, onClose }: { name: string; phone: string; copy: CareFinderCopy; onClose: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="care-call-confirm-title"
        aria-describedby="care-call-confirm-body"
        className="w-full max-w-[520px] rounded-[24px] bg-[var(--cf-surface)] p-6 text-[var(--cf-text)] shadow-2xl"
      >
        <h2 id="care-call-confirm-title" className="text-[26px] font-semibold leading-tight">{copy.contact.confirmTitle(name)}</h2>
        <p id="care-call-confirm-body" className="mt-3 text-[19px] leading-relaxed text-[var(--cf-text-2)]">{copy.contact.confirmBody(phone)}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <a href={telHref(phone)} onClick={onClose} className={actionClass("primary")} data-testid="link-confirm-call">
            <Phone size={22} aria-hidden="true" />
            <span>{copy.contact.confirmYes}</span>
          </a>
          <button ref={cancelRef} type="button" onClick={onClose} className={actionClass("secondary")}>{copy.contact.confirmNo}</button>
        </div>
      </div>
    </div>
  );
}

export function ContactStep({
  heading,
  option,
  copy,
  onBackToOptions,
  onArrangeRide,
}: {
  heading: (children: ReactNode) => ReactNode;
  option: CareFinderResultOption;
  copy: CareFinderCopy;
  onBackToOptions: () => void;
  onArrangeRide?: () => void;
}) {
  const c = copy.contact;
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-6">
      {heading(c.heading(option.name))}
      {option.address || option.travel_text || option.phone ? (
        <div className="space-y-2 text-[19px] text-[var(--cf-text)]">
          {option.address ? (
            <p className="flex items-start gap-2"><MapPin size={20} className="mt-1 shrink-0" aria-hidden="true" />{option.address}</p>
          ) : null}
          {option.travel_text ? <p className="pl-7 text-[17px] text-[var(--cf-text-2)]">{option.travel_text}</p> : null}
          {option.phone ? (
            <p className="flex items-center gap-2"><Phone size={20} className="shrink-0" aria-hidden="true" />{option.phone}</p>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3">
        {option.phone ? (
          <ActionButton onClick={() => setConfirming(true)} icon={<Phone size={22} />} testId="button-care-call">{c.call(option.name)}</ActionButton>
        ) : (
          <Notice tone="warn">{c.noPhone}</Notice>
        )}
        {/* Other ways to get in touch: quiet links on one line, not more big buttons. */}
        {option.booking_url || option.website || option.email ? (
          <div className="flex flex-wrap justify-center gap-x-2">
            {option.booking_url ? (
              <a href={option.booking_url} target="_blank" rel="noreferrer" className={actionClass("quiet", "cf-btn-inline px-4")}>
                <ExternalLink size={20} aria-hidden="true" className="shrink-0" /><span>{c.bookingLink}</span>
              </a>
            ) : option.website ? (
              <a href={option.website} target="_blank" rel="noreferrer" className={actionClass("quiet", "cf-btn-inline px-4")}>
                <ExternalLink size={20} aria-hidden="true" className="shrink-0" /><span>{c.website}</span>
              </a>
            ) : null}
            {option.email ? (
              <a href={`mailto:${option.email}`} className={actionClass("quiet", "cf-btn-inline px-4")} data-testid="link-care-email">
                <Mail size={20} aria-hidden="true" className="shrink-0" /><span>{c.email}</span>
              </a>
            ) : null}
          </div>
        ) : null}
        {onArrangeRide ? (
          <div>
            <ActionButton variant="secondary" onClick={onArrangeRide} icon={<Car size={22} />}>{c.ride}</ActionButton>
            <p className="mt-1 text-[17px] text-[var(--cf-text-2)]">{c.rideNote}</p>
          </div>
        ) : null}
      </section>


      <ActionButton variant="quiet" onClick={onBackToOptions}>{c.otherOptions}</ActionButton>

      {confirming && option.phone ? (
        <ConfirmCallDialog name={option.name} phone={option.phone} copy={copy} onClose={() => setConfirming(false)} />
      ) : null}
    </div>
  );
}
