import { Download, Share2, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const DISMISS_KEY = "vyva-pwa-install-dismissed";

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone);
}

function isIosDevice() {
  const platform = window.navigator.platform.toLowerCase();
  const agent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(platform) || /iphone|ipad|ipod/.test(agent);
}

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Ignore storage failures; the prompt can simply appear again later.
  }
}

export default function PwaInstallPrompt() {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    setIos(isIosDevice());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setStandalone(true);
      setDeferredPrompt(null);
      writeDismissed();
      setDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleDismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => null);
    setDeferredPrompt(null);
    if (choice?.outcome === "accepted") {
      writeDismissed();
      setDismissed(true);
    }
  };

  const canPromptInstall = Boolean(deferredPrompt);
  const showIosGuidance = ios && !standalone && !canPromptInstall;
  if (dismissed || standalone || (!canPromptInstall && !showIosGuidance)) return null;

  return (
    <aside
      aria-label={t("pwaInstall.ariaLabel", "Add VYVA to this device")}
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-[440px] rounded-[22px] border border-[#E8DDF3] bg-white/95 p-4 text-[#2F183F] shadow-[0_22px_70px_rgba(47,24,63,0.22)] backdrop-blur sm:right-5 sm:left-auto sm:bottom-5"
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("pwaInstall.dismissAria", "Dismiss install reminder")}
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#6F6475] transition hover:bg-[#F7F0FF] hover:text-[#8253AB]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex gap-3 pr-8">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3E8FF] text-[#8253AB]">
          {showIosGuidance ? <Share2 className="h-5 w-5" aria-hidden="true" /> : <Smartphone className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div>
          <p className="font-body text-base font-black leading-tight">{t("pwaInstall.title", "Keep VYVA easy to find")}</p>
          <p className="mt-1 font-body text-sm leading-5 text-[#6F6475]">
            {showIosGuidance
              ? t("pwaInstall.iosBody", "In Safari, tap Share, then Add to Home Screen.")
              : t("pwaInstall.body", "Add VYVA to your desktop, dock, or app launcher.")}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        {canPromptInstall ? (
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#8253AB] px-4 font-body text-sm font-bold text-white transition hover:bg-[#6B3E91]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("pwaInstall.action", "Add VYVA")}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#8253AB] px-4 font-body text-sm font-bold text-white transition hover:bg-[#6B3E91]"
          >
            {t("pwaInstall.dismiss", "Got it")}
          </button>
        )}
      </div>
    </aside>
  );
}
