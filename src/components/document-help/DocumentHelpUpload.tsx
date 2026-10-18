import { useEffect, useId, useRef, useState } from "react";
import { Camera, FileCheck2, Loader2, RefreshCw, Upload, X } from "lucide-react";
import type { DocumentHelpReading } from "../../../shared/documentHelpReading";
import { DOCUMENT_HELP_ACCEPT } from "@/lib/documentHelpReader";
import { DocumentHelpNotice } from "./DocumentHelpNotice";

export type DocumentHelpUploadProblem =
  | "unsupported"
  | "too_large"
  | "image_unopenable"
  | "network"
  | "server";

export type DocumentHelpUploadState =
  | { status: "idle" }
  | { status: "reading"; fileName: string }
  | { status: "done"; fileName: string | null; reading: DocumentHelpReading }
  | { status: "error"; problem: DocumentHelpUploadProblem };

type DocumentHelpUploadProps = {
  title: string;
  recommended: boolean;
  state: DocumentHelpUploadState;
  isSpanish: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
};

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false
  ));
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(query.matches);
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return coarse;
}

function problemCopy(problem: DocumentHelpUploadProblem, isSpanish: boolean): { title: string; body: string } {
  const copy: Record<DocumentHelpUploadProblem, [string, string, string, string]> = {
    unsupported: [
      "This type of file can't be read",
      "Please use a photo or a PDF file.",
      "Este tipo de archivo no se puede leer",
      "Use una foto o un archivo PDF, por favor.",
    ],
    too_large: [
      "This file is too large",
      "Please use a file under 15 MB, or take a photo instead.",
      "El archivo es demasiado grande",
      "Use un archivo de menos de 15 MB, o haga una foto.",
    ],
    image_unopenable: [
      "This photo couldn't be opened",
      "Try taking the photo again, or save it as a JPG first.",
      "No se ha podido abrir la foto",
      "Pruebe a hacer la foto de nuevo, o guárdela como JPG.",
    ],
    network: [
      "VYVA couldn't connect",
      "Check your internet connection and try again. Nothing you've typed has been lost.",
      "VYVA no ha podido conectarse",
      "Revise su conexión a internet e inténtelo de nuevo. No se ha perdido nada de lo escrito.",
    ],
    server: [
      "Something went wrong while reading",
      "Please try again. Nothing you've typed has been lost.",
      "Algo ha fallado al leer",
      "Inténtelo de nuevo, por favor. No se ha perdido nada de lo escrito.",
    ],
  };
  const [titleEn, bodyEn, titleEs, bodyEs] = copy[problem];
  return isSpanish ? { title: titleEs, body: bodyEs } : { title: titleEn, body: bodyEn };
}

function foundSummary(reading: DocumentHelpReading, isSpanish: boolean): string | null {
  const parts: string[] = [];
  if (reading.organization) parts.push(isSpanish ? "quién la envía" : "who sent it");
  if (reading.dates.length) {
    parts.push(isSpanish
      ? `${reading.dates.length} ${reading.dates.length === 1 ? "fecha" : "fechas"}`
      : `${reading.dates.length} ${reading.dates.length === 1 ? "date" : "dates"}`);
  }
  if (reading.amounts.length) {
    parts.push(isSpanish
      ? `${reading.amounts.length} ${reading.amounts.length === 1 ? "importe" : "importes"}`
      : `${reading.amounts.length} ${reading.amounts.length === 1 ? "amount" : "amounts"}`);
  }
  if (!parts.length) return null;
  return `${isSpanish ? "Ha encontrado" : "Found"}: ${parts.join(" · ")}`;
}

export function DocumentHelpUpload({ title, recommended, state, isSpanish, onFile, onClear }: DocumentHelpUploadProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const coarsePointer = useCoarsePointer();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFile(file);
  };

  const pickers = (
    <div className="flex flex-col gap-3 sm:flex-row">
      {coarsePointer ? (
        <button type="button" className="dh-btn dh-btn-primary font-body sm:flex-1" onClick={() => cameraRef.current?.click()} data-testid="button-document-help-camera">
          <Camera size={24} aria-hidden="true" />
          {isSpanish ? "Hacer una foto" : "Take a photo"}
        </button>
      ) : null}
      <button
        type="button"
        className={`dh-btn ${coarsePointer ? "dh-btn-secondary" : "dh-btn-primary"} font-body sm:flex-1`}
        onClick={() => fileRef.current?.click()}
        data-testid="button-document-help-upload"
      >
        <Upload size={24} aria-hidden="true" />
        {isSpanish ? "Subir un documento" : "Upload a document"}
      </button>
    </div>
  );

  return (
    <section aria-labelledby={headingId} className="dh-card p-5 sm:p-6" data-testid="document-help-upload" data-upload-status={state.status}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={headingId} className="font-body text-[21px] font-bold leading-snug">{title}</h3>
        <span className={`dh-tag ${recommended ? "dh-tone-accent" : "dh-tone-neutral"}`}>
          {recommended ? (isSpanish ? "Recomendado" : "Recommended") : (isSpanish ? "Opcional" : "Optional")}
        </span>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleChange} data-testid="input-document-help-camera" />
      <input ref={fileRef} type="file" accept={DOCUMENT_HELP_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={handleChange} data-testid="input-document-help-file" />

      {/* min-height keeps the page from jumping while VYVA reads */}
      <div className="mt-3 min-h-[140px]" aria-live="polite">
        {state.status === "idle" || state.status === "error" ? (
          <>
            <p className="dh-muted font-body text-[18px] leading-relaxed">
              {isSpanish
                ? "Póngalo plano, con buena luz y la página entera a la vista. Fotos o PDF, hasta 15 MB."
                : "Lay it flat in good light, with the whole page in view. Photos or PDF files, up to 15 MB."}
            </p>
            {state.status === "error" ? (
              <div className="mt-3">
                <DocumentHelpNotice tone="danger" title={problemCopy(state.problem, isSpanish).title} live="alert" testId="document-help-upload-error">
                  {problemCopy(state.problem, isSpanish).body}
                </DocumentHelpNotice>
              </div>
            ) : null}
            <div className="mt-4">{pickers}</div>
            {recommended ? (
              <p className="dh-muted mt-3 font-body text-[17px] leading-snug">
                {isSpanish ? "¿No lo tiene a mano? Puede seguir sin él." : "Don't have it to hand? You can carry on without it."}
              </p>
            ) : null}
          </>
        ) : null}

        {state.status === "reading" ? (
          <div className="flex items-center gap-4 rounded-[16px] px-4 py-5" style={{ background: "var(--dh-surface-muted)" }} data-testid="document-help-reading">
            <Loader2 size={30} className="dh-spin flex-shrink-0 animate-spin" style={{ color: "var(--dh-accent)" }} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-body text-[19px] font-bold">{isSpanish ? "Leyendo su documento…" : "Reading your document…"}</p>
              <p className="dh-muted break-words font-body text-[17px]">
                {isSpanish ? "Puede tardar hasta medio minuto." : "This can take up to half a minute."}
              </p>
            </div>
          </div>
        ) : null}

        {state.status === "done" ? (
          <div className="space-y-3" data-testid="document-help-read-result">
            {state.reading.status === "read" ? (
              <>
                <p className="flex items-start gap-3 font-body text-[19px] font-bold" style={{ color: "var(--dh-safe)" }}>
                  <FileCheck2 size={26} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span>{isSpanish ? "VYVA ha leído su documento" : "VYVA has read your document"}</span>
                </p>
                {state.fileName ? <p className="dh-muted break-all font-body text-[17px]">{state.fileName}</p> : null}
                {foundSummary(state.reading, isSpanish) ? (
                  <p className="font-body text-[18px]">{foundSummary(state.reading, isSpanish)}</p>
                ) : null}
                {state.reading.confidence === "low" || state.reading.unclear.length > 0 ? (
                  <DocumentHelpNotice tone="warn" title={isSpanish ? "Puede que no lo haya leído bien" : "I may not have read this correctly"}>
                    {isSpanish
                      ? "Podrá comprobarlo todo en la siguiente pantalla."
                      : "You'll be able to check everything on the next screen."}
                  </DocumentHelpNotice>
                ) : null}
              </>
            ) : state.reading.status === "unreadable" ? (
              <DocumentHelpNotice tone="warn" title={isSpanish ? "VYVA no ha podido leerlo con claridad" : "VYVA couldn't read this clearly"} testId="document-help-unreadable">
                {isSpanish
                  ? "Pruebe otra vez con buena luz y la página plana. O siga y escriba los datos clave más abajo."
                  : "Try again in good light, with the page flat and in view. Or carry on and type the key details below."}
              </DocumentHelpNotice>
            ) : (
              <DocumentHelpNotice tone="info" title={isSpanish ? "Ahora mismo no se pueden leer documentos" : "Reading documents isn't available right now"} testId="document-help-unavailable">
                {isSpanish
                  ? "Puede seguir: escriba los datos clave más abajo y el equipo de VYVA le ayudará desde ahí."
                  : "You can carry on: type the key details below and VYVA's team will help from there."}
              </DocumentHelpNotice>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button type="button" className="dh-btn dh-btn-secondary font-body" onClick={() => (coarsePointer ? cameraRef : fileRef).current?.click()} data-testid="button-document-help-replace">
                <RefreshCw size={22} aria-hidden="true" />
                {state.reading.status === "read"
                  ? (isSpanish ? "Usar otra foto o archivo" : "Use a different photo or file")
                  : (isSpanish ? "Intentar de nuevo" : "Try again")}
              </button>
              <button type="button" className="dh-btn dh-btn-quiet font-body" onClick={onClear} data-testid="button-document-help-clear">
                <X size={22} aria-hidden="true" />
                {isSpanish ? "Quitar el documento" : "Remove the document"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
