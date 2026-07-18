import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, ClipboardPaste, FileUp, Link2, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import {
  SHOW_VYVA_USE_CASES,
  SHOW_VYVA_USE_CASE_IDS,
  inferShowVyvaPasteSource,
  type ShowVyvaCaptureSource,
  type ShowVyvaPastePayload,
  type ShowVyvaUseCase,
  type ShowVyvaUseCaseId,
} from "../../shared/showVyvaFlow";

type FileCaptureSource = Extract<ShowVyvaCaptureSource, "camera" | "upload">;

type ShowVyvaChooserProps = {
  defaultUseCaseId?: ShowVyvaUseCaseId;
  useCaseIds?: ShowVyvaUseCaseId[];
  busy?: boolean;
  title?: string;
  subtitle?: string;
  onChooseFileSource: (source: FileCaptureSource, useCase: ShowVyvaUseCase, question: string) => void;
  onPaste?: (payload: ShowVyvaPastePayload, useCase: ShowVyvaUseCase) => void;
};

const SOURCE_STYLES: Record<FileCaptureSource | "paste", { bg: string; text: string; border: string }> = {
  camera: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  upload: { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE" },
  paste: { bg: "#ECFDF5", text: "#047857", border: "#BBF7D0" },
};

function getMatchingUseCases(ids: ShowVyvaUseCaseId[] | undefined) {
  if (!ids?.length) return SHOW_VYVA_USE_CASES;
  const allowed = new Set(ids);
  return SHOW_VYVA_USE_CASES.filter((useCase) => allowed.has(useCase.id));
}

export default function ShowVyvaChooser({
  defaultUseCaseId = SHOW_VYVA_USE_CASE_IDS.scamCheck,
  useCaseIds,
  busy = false,
  title,
  subtitle,
  onChooseFileSource,
  onPaste,
}: ShowVyvaChooserProps) {
  const { t } = useTranslation();
  const useCases = useMemo(() => getMatchingUseCases(useCaseIds), [useCaseIds]);
  const safeDefault = useCases.some((item) => item.id === defaultUseCaseId)
    ? defaultUseCaseId
    : useCases[0]?.id ?? SHOW_VYVA_USE_CASE_IDS.scamCheck;
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<ShowVyvaUseCaseId>(safeDefault);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [question, setQuestion] = useState("");
  const selectedUseCase = useCases.find((item) => item.id === selectedUseCaseId) ?? useCases[0] ?? SHOW_VYVA_USE_CASES[0];
  const canPaste = Boolean(onPaste) && (
    selectedUseCase.acceptedSources.includes("paste_text") ||
    selectedUseCase.acceptedSources.includes("paste_link")
  );
  const pasteSource = inferShowVyvaPasteSource(pasteValue);
  const pasteAllowed = selectedUseCase.acceptedSources.includes(pasteSource);

  const handleFileSource = (source: FileCaptureSource) => {
    if (!selectedUseCase.acceptedSources.includes(source)) return;
    onChooseFileSource(source, selectedUseCase, question.trim());
  };

  const handlePasteSubmit = () => {
    const value = pasteValue.trim();
    if (!value || !onPaste) return;
    const source = inferShowVyvaPasteSource(value);
    if (!selectedUseCase.acceptedSources.includes(source)) return;
    onPaste({ useCaseId: selectedUseCase.id, source, value, question: question.trim() || undefined }, selectedUseCase);
    setPasteValue("");
    setPasteOpen(false);
  };

  return (
    <section
      data-testid="show-vyva-chooser"
      className="rounded-[20px] border border-[#EDE5DB] bg-white p-4 shadow-[0_12px_30px_rgba(63,45,35,0.07)]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
          <ShieldCheck size={23} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-body text-[21px] font-black leading-tight text-vyva-text-1">
            {title ?? t("showVyva.title", "Show VYVA")}
          </h2>
          <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
            {subtitle ?? t("showVyva.subtitle", "Camera, upload, or paste. You confirm before anything is shared.")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label={t("showVyva.useCaseLabel", "What should VYVA review?")}>
        {useCases.map((useCase) => {
          const active = useCase.id === selectedUseCase.id;
          return (
            <button
              key={useCase.id}
              type="button"
              data-testid={`button-show-vyva-use-case-${useCase.id}`}
              onClick={() => {
                setSelectedUseCaseId(useCase.id);
                setPasteOpen(false);
              }}
              className={`min-h-10 flex-shrink-0 rounded-full border px-3 font-body text-[13px] font-black transition ${
                active
                  ? "border-vyva-purple bg-[#F5F3FF] text-vyva-purple"
                  : "border-[#EDE5DB] bg-[#FFFCF8] text-[#6F5F59]"
              }`}
              aria-pressed={active}
            >
              {t(`showVyva.useCase.${useCase.id}`, useCase.shortLabel)}
            </button>
          );
        })}
      </div>

      <p data-testid="text-show-vyva-prompt" className="mt-3 font-body text-[15px] font-extrabold leading-snug text-vyva-text-1">
        {t(`showVyva.prompt.${selectedUseCase.id}`, selectedUseCase.prompt)}
      </p>

      <label className="mt-3 flex min-h-[50px] items-center gap-2 rounded-[15px] border border-[#EDE5DB] bg-[#FFFCF8] px-3 focus-within:border-vyva-purple focus-within:ring-2 focus-within:ring-[#EDE9FE]">
        <MessageCircleQuestion size={18} className="flex-shrink-0 text-vyva-purple" aria-hidden="true" />
        <span className="sr-only">{t("showVyva.questionLabel", "What would you like to know?")}</span>
        <input
          data-testid="input-show-vyva-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-3 font-body text-[14px] font-semibold text-vyva-text-1 outline-none placeholder:text-[#8A7A73]"
          placeholder={t("showVyva.questionPlaceholder", "What would you like to know? Optional")}
          maxLength={240}
        />
      </label>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          data-testid="button-show-vyva-source-camera"
          onClick={() => handleFileSource("camera")}
          disabled={busy || !selectedUseCase.acceptedSources.includes("camera")}
          className="vyva-tap flex min-h-[54px] items-center justify-center gap-2 rounded-[16px] border px-3 font-body text-[14px] font-black disabled:opacity-50"
          style={{ background: SOURCE_STYLES.camera.bg, color: SOURCE_STYLES.camera.text, borderColor: SOURCE_STYLES.camera.border }}
        >
          <Camera size={18} aria-hidden="true" />
          {busy ? t("showVyva.busy", "Reviewing...") : t("showVyva.camera", "Camera")}
        </button>
        <button
          type="button"
          data-testid="button-show-vyva-source-upload"
          onClick={() => handleFileSource("upload")}
          disabled={busy || !selectedUseCase.acceptedSources.includes("upload")}
          className="vyva-tap flex min-h-[54px] items-center justify-center gap-2 rounded-[16px] border px-3 font-body text-[14px] font-black disabled:opacity-50"
          style={{ background: SOURCE_STYLES.upload.bg, color: SOURCE_STYLES.upload.text, borderColor: SOURCE_STYLES.upload.border }}
        >
          <FileUp size={18} aria-hidden="true" />
          {t("showVyva.upload", "Upload")}
        </button>
        {canPaste ? (
          <button
            type="button"
            data-testid="button-show-vyva-source-paste"
            onClick={() => setPasteOpen((open) => !open)}
            disabled={busy}
            className="vyva-tap flex min-h-[54px] items-center justify-center gap-2 rounded-[16px] border px-3 font-body text-[14px] font-black disabled:opacity-50"
            style={{ background: SOURCE_STYLES.paste.bg, color: SOURCE_STYLES.paste.text, borderColor: SOURCE_STYLES.paste.border }}
            aria-expanded={pasteOpen}
          >
            {pasteValue.trim().startsWith("http") ? <Link2 size={18} aria-hidden="true" /> : <ClipboardPaste size={18} aria-hidden="true" />}
            {t("showVyva.paste", "Paste text or link")}
          </button>
        ) : null}
      </div>

      {pasteOpen && canPaste ? (
        <div className="mt-3 rounded-[16px] border border-[#BBF7D0] bg-[#F0FDF4] p-3" data-testid="section-show-vyva-paste">
          <label className="block">
            <span className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#047857]">
              {t("showVyva.pasteLabel", "Paste what you want VYVA to review")}
            </span>
            <textarea
              data-testid="textarea-show-vyva-paste"
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              rows={3}
              className="mt-2 w-full rounded-[14px] border border-[#BBF7D0] bg-white px-3 py-2 font-body text-[15px] font-semibold text-vyva-text-1 outline-none focus:ring-2 focus:ring-[#99F6E4]"
              placeholder={t("showVyva.pastePlaceholder", "Paste a message, link, phone number, quote, or form text")}
            />
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-body text-[12px] font-semibold text-[#047857]">
              {pasteSource === "paste_link" ? t("showVyva.linkDetected", "Link detected") : t("showVyva.textDetected", "Text detected")}
            </p>
            <button
              type="button"
              data-testid="button-show-vyva-submit-paste"
              onClick={handlePasteSubmit}
              disabled={!pasteValue.trim() || !pasteAllowed}
              className="min-h-11 rounded-full bg-[#0F766E] px-4 font-body text-[14px] font-black text-white disabled:opacity-50"
            >
              {t("showVyva.reviewPasted", "Review safely")}
            </button>
          </div>
        </div>
      ) : null}

      <p data-testid="text-show-vyva-confirmation" className="mt-3 rounded-[14px] bg-[#FFFCF8] px-3 py-2 font-body text-[12px] font-bold leading-snug text-[#6F5F59]">
        {t(`showVyva.confirmation.${selectedUseCase.id}`, selectedUseCase.confirmation)}
      </p>
    </section>
  );
}
