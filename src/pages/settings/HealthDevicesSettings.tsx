import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Apple,
  Bluetooth,
  Check,
  ChevronRight,
  Droplets,
  Heart,
  Loader2,
  Scale,
  Stethoscope,
  Thermometer,
  Wind,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { PurpleModal, VYVA_MODAL_PRIMARY_ACTION_CLASS, VYVA_MODAL_SECONDARY_ACTION_CLASS } from "@/components/vyva-ui";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import {
  VITALS_DEVICE_CATALOG,
  VITALS_PILOT_DEVICE_MODELS,
  type VitalsDeviceCatalogItem,
  type VitalsDeviceKind,
  type VitalsDeviceModel,
} from "@/lib/vitalsDeviceCatalog";
import {
  bluetoothReadErrorCode,
  isWebBluetoothSupported,
  readStandardBluetoothDevice,
  type BluetoothCaptureState,
  type BluetoothReadResult,
} from "@/lib/vitalsBluetooth";
import { VITALS_SIGNAL_CATALOG } from "../../../shared/vitalsSignalCatalog";
import { formatVitalsReadingDisplay, type ProposedVitalsReading } from "../../../shared/vitalsParsing";
import { VITALS_PROVIDER_CATALOG, type VitalsProviderId } from "@/lib/vitalsProviderCatalog";

type StoredHealthDevice = {
  id: VitalsDeviceKind;
  deviceName?: string;
  connectedAt: string;
  method: "web_bluetooth";
  status?: "ready" | "not_set" | "failed";
  sourceRef?: Record<string, unknown>;
};

const DEVICE_ICON_BY_ID: Record<VitalsDeviceKind, LucideIcon> = {
  bp_cuff: Activity,
  pulse_oximeter: Wind,
  thermometer: Thermometer,
  glucose_meter: Stethoscope,
  weight_scale: Scale,
  heart_monitor: Heart,
};

const PROVIDER_ICON_BY_ID: Record<VitalsProviderId, LucideIcon> = {
  apple_health: Apple,
  libreview: Droplets,
  withings: Watch,
};

function signalLabel(signal: string) {
  return VITALS_SIGNAL_CATALOG[signal as keyof typeof VITALS_SIGNAL_CATALOG]?.shortLabel ?? signal;
}

function DeviceSetupModal({
  device,
  model,
  onClose,
  onReady,
}: {
  device: VitalsDeviceCatalogItem;
  model?: VitalsDeviceModel;
  onClose: () => void;
  onReady: (device: StoredHealthDevice) => Promise<void>;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [state, setState] = useState<BluetoothCaptureState>(isWebBluetoothSupported() ? "supported" : "unsupported");
  const [readings, setReadings] = useState<ProposedVitalsReading[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [readResult, setReadResult] = useState<BluetoothReadResult | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const Icon = DEVICE_ICON_BY_ID[device.id];
  const isBusy = state === "searching" || state === "connected" || state === "waiting";
  const setupLabel = model?.label ?? device.label;

  const stateCopy: Record<BluetoothCaptureState, string> = {
    supported: t("settings.healthDevices.bluetooth.supported", "Ready to search nearby standard Bluetooth devices."),
    unsupported: t("settings.healthDevices.bluetooth.unsupported", "Bluetooth setup is not available in this browser. You can still scan, say, or type readings from Vitals."),
    searching: t("settings.healthDevices.bluetooth.searching", "Searching for your device..."),
    connected: t("settings.healthDevices.bluetooth.connected", "Connected. Keep the device nearby."),
    waiting: t("settings.healthDevices.bluetooth.waiting", "Waiting for a measurement..."),
    reading_found: t("settings.healthDevices.bluetooth.readingFound", "Reading found."),
    needs_confirmation: t("settings.healthDevices.bluetooth.confirm", "Confirm this device in Settings before using it in Vitals."),
    failed: t("settings.healthDevices.bluetooth.failed", "Could not read this device. Try scan, voice, or typing from Vitals."),
  };

  const startBluetooth = async () => {
    setReadings([]);
    setReadResult(null);
    setError("");
    try {
      const result = await readStandardBluetoothDevice(device, setState, model);
      setReadings(result.readings);
      setDeviceName(result.deviceName);
      setReadResult(result);
    } catch (err) {
      const code = bluetoothReadErrorCode(err);
      setState(code === "unsupported" ? "unsupported" : "failed");
      const errorCopy: Partial<Record<NonNullable<typeof code>, string>> = {
        unsupported: t("settings.healthDevices.errors.unsupported", "Use Chrome or Edge on a compatible computer or Android device."),
        user_cancelled: t("settings.healthDevices.errors.cancelled", "No device was selected. Search again when you are ready."),
        connection_failed: t("settings.healthDevices.errors.connection", "VYVA could not connect. Keep the device awake and nearby, then try again."),
        service_unavailable: t("settings.healthDevices.errors.service", "This device does not expose the expected standard measurement service."),
        measurement_timeout: t("settings.healthDevices.errors.timeout", "No measurement arrived. Take a fresh reading while the device stays nearby."),
        empty_measurement: t("settings.healthDevices.errors.empty", "The device connected but did not send a measurement."),
        parse_failed: t("settings.healthDevices.errors.parse", "The device sent a measurement format VYVA does not yet support."),
      };
      setError((code && errorCopy[code]) || t("settings.healthDevices.bluetooth.failedShort", "Bluetooth read failed."));
    }
  };

  const markReady = async () => {
    setIsSaving(true);
    setError("");
    try {
      await onReady({
        id: device.id,
        deviceName: deviceName || device.label,
        connectedAt: new Date().toISOString(),
        method: "web_bluetooth",
        status: "ready",
        sourceRef: {
          provider: "web_bluetooth",
          device_type: device.id,
          device_name: deviceName || device.label,
          model_id: model?.id,
          model_label: model?.label,
          support_level: model?.supportLevel ?? "experimental",
          service_uuid: readResult ? `0x${readResult.serviceUuid.toString(16)}` : undefined,
          characteristic_uuid: readResult ? `0x${readResult.characteristicUuid.toString(16)}` : undefined,
          parser_version: readResult?.parserVersion,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.healthDevices.saveFailed", "Could not save this device."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PurpleModal
      Icon={Icon}
      kicker={t("settings.healthDevices.kicker", "Health devices")}
      title={setupLabel}
      subtitle={device.helper}
      titleId="health-device-setup-title"
      onClose={onClose}
      closeLabel={t("common.close", "Close")}
      panelTestId="health-device-setup-modal"
      size="wide"
    >

        <div className="mb-4 rounded-[20px] border border-[#E9D5FF] bg-[#FAF5FF] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 font-body text-[10px] font-black uppercase tracking-[0.08em] ${model ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#F3E8FF] text-[#6B21A8]"}`}>
              {model ? t("settings.healthDevices.pilotCandidate", "Pilot candidate") : t("settings.healthDevices.experimental", "Experimental")}
            </span>
            <span className="font-body text-[12px] font-bold text-vyva-text-2">
              {model
                ? t("settings.healthDevices.candidateDisclosure", "Not yet labelled Tested with VYVA — physical bench testing is still required.")
                : t("settings.healthDevices.experimentalDisclosure", "Compatibility depends on the device exposing the standard Bluetooth service.")}
            </span>
          </div>
          <ol className="mt-3 grid gap-1.5 font-body text-[13px] font-bold leading-snug text-vyva-text-1">
            <li>1. {t("settings.healthDevices.steps.power", "Turn on the device and keep it nearby.")}</li>
            <li>2. {t("settings.healthDevices.steps.search", "Tap Search, then choose {{model}} in the browser list.", { model: setupLabel })}</li>
            <li>3. {t("settings.healthDevices.steps.measure", "Take a fresh measurement and wait for VYVA to find it.")}</li>
          </ol>
        </div>

        <div className="rounded-[24px] border border-[#EDE5DB] bg-[#FAF9F6] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-white text-[#047857]">
              {isBusy ? <Loader2 size={18} className="animate-spin" /> : <Bluetooth size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.11em] text-vyva-purple">
                {t("settings.healthDevices.bluetooth.title", "Bluetooth setup")}
              </p>
              <p className="mt-1 font-body text-[15px] font-bold leading-snug text-vyva-text-1" data-testid={`health-device-state-${state}`}>
                {stateCopy[state]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={startBluetooth}
            disabled={state === "unsupported" || isBusy}
            className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} mt-4`}
            data-testid="button-health-device-start-bluetooth"
          >
            {isBusy ? <Loader2 size={18} className="animate-spin" /> : <Bluetooth size={18} />}
            {t("settings.healthDevices.bluetooth.try", "Search for device")}
          </button>
        </div>

        {readings.length > 0 && (
          <div className="mt-4 rounded-[24px] border border-[#CFEFE4] bg-[#ECFDF5] p-4">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.11em] text-[#047857]">
              {t("settings.healthDevices.readingFoundTitle", "Test reading found")}
            </p>
            <div className="mt-3 grid gap-2">
              {readings.map((reading) => (
                <div key={`${reading.signal_type}-${reading.value}`} className="rounded-[18px] bg-white px-4 py-3 font-body text-[15px] font-black text-vyva-text-1">
                  {formatVitalsReadingDisplay(reading)}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={markReady}
              disabled={isSaving}
              className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} mt-4 bg-[#047857] shadow-[0_14px_28px_rgba(4,120,87,0.18)]`}
              data-testid="button-health-device-mark-ready"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {isSaving ? t("settings.healthDevices.saving", "Saving...") : t("settings.healthDevices.markReady", "Mark device ready")}
            </button>
          </div>
        )}

        {(state === "unsupported" || state === "failed" || error) && (
          <div className="mt-4 rounded-[22px] border border-[#FED7AA] bg-[#FFF7ED] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[#B45309]" />
              <p className="font-body text-[13px] font-bold leading-snug text-[#92400E]">
                {error || t("settings.healthDevices.fallbackBody", "No problem. Vitals can still read the number by photo, voice, or typing.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/health/vitals")}
              className={`${VYVA_MODAL_SECONDARY_ACTION_CLASS} mt-3`}
              data-testid="button-health-device-open-vitals-from-modal"
            >
              {t("settings.healthDevices.openVitals", "Open Vitals")}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
    </PurpleModal>
  );
}

export default function HealthDevicesSettings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedSetup, setSelectedSetup] = useState<{ device: VitalsDeviceCatalogItem; model?: VitalsDeviceModel } | null>(null);
  const [deviceActionError, setDeviceActionError] = useState("");
  const [connectedProviderIds, setConnectedProviderIds] = useState<Set<VitalsProviderId>>(() => new Set());
  const { data, isLoading } = useQuery<{ devices: StoredHealthDevice[] }>({
    queryKey: ["/api/settings/health-devices"],
    retry: false,
  });
  const readyById = useMemo(() => {
    const storedDevices = data?.devices ?? [];
    return new Map(storedDevices.map((device) => [device.id, device]));
  }, [data?.devices]);
  const bluetoothSupported = isWebBluetoothSupported();

  const updateDeviceCache = (payload: { devices: StoredHealthDevice[] }) => {
    queryClient.setQueryData(["/api/settings/health-devices"], payload);
  };

  const markDeviceReady = async (device: StoredHealthDevice) => {
    setDeviceActionError("");
    const response = await apiFetch("/api/settings/health-devices", {
      method: "POST",
      body: JSON.stringify({ device }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error ?? t("settings.healthDevices.saveFailed", "Could not save this device."));
    }
    updateDeviceCache(payload as { devices: StoredHealthDevice[] });
  };

  const removeDevice = async (deviceId: VitalsDeviceKind) => {
    setDeviceActionError("");
    const response = await apiFetch(`/api/settings/health-devices/${deviceId}`, { method: "DELETE" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setDeviceActionError(payload?.error ?? t("settings.healthDevices.removeFailed", "Could not remove this device."));
      return;
    }
    updateDeviceCache(payload as { devices: StoredHealthDevice[] });
  };

  const previewProviderConnection = (providerId: VitalsProviderId) => {
    if (providerId === "apple_health") {
      // TODO: real OAuth for Apple Health.
    } else if (providerId === "libreview") {
      // TODO: real OAuth for LibreView.
    } else {
      // TODO: real OAuth for Withings.
    }
    setConnectedProviderIds((current) => {
      const next = new Set(current);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
  };

  return (
    <PhoneFrame subtitle={t("settings.healthDevices.subtitle", "Health devices")} showBack onBack={() => navigate("/settings")}>
      <div className="flex flex-col gap-4 px-1 pb-6 pt-5 sm:px-2 md:px-3" data-testid="health-devices-settings">
        <section className="rounded-[24px] border border-[#EFE4D5] bg-white p-4 shadow-[0_10px_26px_rgba(53,28,87,0.055)]" data-testid="health-devices-summary">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-text-2">
            {t("settings.healthDevices.compactKicker", "Device setup")}
          </p>
          <p className="mt-1 font-body text-[15px] font-bold leading-snug text-vyva-text-1">
            {t("settings.healthDevices.compactBody", "Set up devices here. Add readings in Vitals.")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/health/vitals")}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#6B21A8] px-4 font-body text-[15px] font-black text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)]"
            data-testid="button-health-devices-open-vitals"
          >
            {t("settings.healthDevices.openVitals", "Open Vitals")}
            <ChevronRight size={17} />
          </button>
        </section>

        <section className="rounded-[24px] border border-[#EFE4D5] bg-white p-4 shadow-[0_10px_26px_rgba(53,28,87,0.055)]" data-testid="bluetooth-pilot-devices-section">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-text-2">
                {t("settings.healthDevices.pilotSection", "Bluetooth pilot devices")}
              </p>
              <p className="mt-1 font-body text-[12px] font-bold leading-snug text-vyva-text-2">
                {t("settings.healthDevices.pilotBody", "The first models selected for physical VYVA compatibility testing.")}
              </p>
            </div>
            <span className={`flex-shrink-0 rounded-full px-3 py-1 font-body text-[11px] font-black ${bluetoothSupported ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FFF7ED] text-[#B45309]"}`}>
              {isLoading ? t("common.loading", "Loading") : bluetoothSupported ? t("settings.healthDevices.supported", "Supported") : t("settings.healthDevices.limited", "Limited")}
            </span>
          </div>

          {deviceActionError && (
            <p className="mb-3 rounded-[16px] bg-[#FEF2F2] px-3 py-2 font-body text-[12px] font-bold text-[#B91C1C]">
              {deviceActionError}
            </p>
          )}

          <div className="grid gap-2">
            {VITALS_PILOT_DEVICE_MODELS.map((model) => {
              const device = VITALS_DEVICE_CATALOG.find((item) => item.id === model.deviceKind)!;
              const Icon = DEVICE_ICON_BY_ID[device.id];
              const stored = readyById.get(device.id);
              const storedModelId = typeof stored?.sourceRef?.model_id === "string" ? stored.sourceRef.model_id : null;
              const isThisModelReady = storedModelId === model.id;
              return (
                <article
                  key={model.id}
                  className="rounded-[20px] border border-[#F0E7DE] bg-[#FFFCF8] p-3 shadow-[0_5px_14px_rgba(63,45,35,0.035)]"
                  data-testid={`device-model-card-${model.id}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px]" style={{ color: device.accent, background: device.bg }}>
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-body text-[15px] font-black leading-tight text-vyva-text-1">{model.label}</p>
                          <p className="mt-0.5 font-body text-[11px] font-bold text-vyva-text-2">{device.label}</p>
                        </div>
                        <span
                          className={`flex-shrink-0 rounded-full px-2 py-0.5 font-body text-[10px] font-black ${isThisModelReady ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FEF3C7] text-[#92400E]"}`}
                          data-testid={`health-device-model-status-${model.id}`}
                        >
                          {isThisModelReady ? t("settings.healthDevices.ready", "Ready") : t("settings.healthDevices.pilotCandidate", "Pilot candidate")}
                        </span>
                      </div>
                      <p className="mt-1 hidden font-body text-[12px] font-semibold leading-snug text-vyva-text-2 sm:block">{device.helper}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {device.signals.map((signal) => (
                          <span key={signal} className="rounded-full px-2 py-0.5 font-body text-[10px] font-black" style={{ color: device.accent, background: device.bg }}>
                            {signalLabel(signal)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {isThisModelReady && stored?.deviceName && (
                    <p className="mt-2 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-bold text-[#047857]">
                      {t("settings.healthDevices.lastReady", "Last checked: {{name}}", { name: stored.deviceName })}
                    </p>
                  )}
                  <div className={`mt-3 grid gap-2 ${isThisModelReady ? "grid-cols-[1fr_auto]" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedSetup({ device, model })}
                      className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[15px] bg-white font-body text-[13px] font-black text-[#6B21A8] shadow-[inset_0_0_0_1px_#DDD6FE]"
                      data-testid={`button-health-device-model-setup-${model.id}`}
                    >
                      <Bluetooth size={15} />
                      {isThisModelReady ? t("settings.healthDevices.testAgain", "Test again") : t("settings.healthDevices.setUp", "Set up")}
                    </button>
                    {isThisModelReady && (
                      <button
                        type="button"
                        onClick={() => removeDevice(device.id)}
                        className="min-h-[42px] rounded-[15px] px-3 font-body text-[12px] font-black text-vyva-text-2 shadow-[inset_0_0_0_1px_#E8DED4]"
                        data-testid={`button-health-device-remove-${device.id}`}
                      >
                        {t("common.remove", "Remove")}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {readyById.size > 0 && (
            <p className="mt-3 rounded-[16px] bg-[#F7F1E9] px-3 py-2 font-body text-[11px] font-bold leading-snug text-vyva-text-2" data-testid="health-device-browser-permission-note">
              {t("settings.healthDevices.removeDisclosure", "Removing a device from VYVA does not clear Bluetooth permission already granted in your browser.")}
            </p>
          )}
        </section>

        <section className="rounded-[24px] border border-[#EFE4D5] bg-white p-4 shadow-[0_10px_26px_rgba(53,28,87,0.055)]" data-testid="bluetooth-experimental-devices-section">
          <div className="mb-3">
            <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-text-2">
              {t("settings.healthDevices.experimentalSection", "Other standard Bluetooth devices")}
            </p>
            <p className="mt-1 font-body text-[12px] font-bold leading-snug text-vyva-text-2">
              {t("settings.healthDevices.experimentalBody", "Experimental: these may work when they expose a standard Bluetooth health service.")}
            </p>
          </div>
          <div className="grid gap-2">
            {VITALS_DEVICE_CATALOG.map((device) => {
              const Icon = DEVICE_ICON_BY_ID[device.id];
              const stored = readyById.get(device.id);
              const isExperimentalReady = Boolean(stored && !stored.sourceRef?.model_id);
              return (
                <article key={device.id} className="rounded-[20px] border border-[#F0E7DE] bg-[#FFFCF8] p-3" data-testid={`device-settings-card-${device.id}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px]" style={{ color: device.accent, background: device.bg }}><Icon size={19} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-body text-[15px] font-black text-vyva-text-1">{device.label}</p>
                        <span className={`rounded-full px-2 py-0.5 font-body text-[10px] font-black ${isExperimentalReady ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#F3E8FF] text-[#6B21A8]"}`} data-testid={`health-device-status-${device.id}`}>
                          {isExperimentalReady ? t("settings.healthDevices.ready", "Ready") : t("settings.healthDevices.experimental", "Experimental")}
                        </span>
                      </div>
                      <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">{device.helper}</p>
                    </div>
                  </div>
                  <div className={`mt-3 grid gap-2 ${isExperimentalReady ? "grid-cols-[1fr_auto]" : ""}`}>
                    <button type="button" onClick={() => setSelectedSetup({ device })} className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[15px] bg-white font-body text-[13px] font-black text-[#6B21A8] shadow-[inset_0_0_0_1px_#DDD6FE]" data-testid={`button-health-device-setup-${device.id}`}>
                      <Bluetooth size={15} />
                      {isExperimentalReady ? t("settings.healthDevices.testAgain", "Test again") : t("settings.healthDevices.tryExperimental", "Try experimental setup")}
                    </button>
                    {isExperimentalReady && <button type="button" onClick={() => removeDevice(device.id)} className="min-h-[42px] rounded-[15px] px-3 font-body text-[12px] font-black text-vyva-text-2 shadow-[inset_0_0_0_1px_#E8DED4]">{t("common.remove", "Remove")}</button>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#EFE4D5] bg-white p-4 shadow-[0_10px_26px_rgba(53,28,87,0.055)]" data-testid="wearables-apps-section">
          <div className="mb-3">
            <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-text-2">
              {t("settings.healthDevices.providersSection", "Wearables & apps")}
            </p>
            <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
              {t("settings.healthDevices.providersFixture", "Preview only — live provider connections require approved API access.")}
            </p>
          </div>

          <div className="grid gap-2">
            {VITALS_PROVIDER_CATALOG.map((provider) => {
              const Icon = PROVIDER_ICON_BY_ID[provider.id];
              const connected = connectedProviderIds.has(provider.id);
              return (
                <article key={provider.id} className="rounded-[20px] border border-[#F0E7DE] bg-[#FFFCF8] p-3 shadow-[0_5px_14px_rgba(63,45,35,0.035)]" data-testid={`provider-settings-card-${provider.id}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px]" style={{ color: provider.accent, background: provider.bg }}>
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-body text-[15px] font-black text-vyva-text-1">{provider.label}</p>
                        <span className={`rounded-full px-2 py-0.5 font-body text-[10px] font-black ${connected ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#F7F1E9] text-vyva-text-2"}`} data-testid={`provider-status-${provider.id}`}>
                          {connected ? t("settings.healthDevices.connectedPreview", "Connected demo") : t("settings.healthDevices.notConnected", "Not connected")}
                        </span>
                      </div>
                      <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-2">{provider.helper}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {provider.signals.map((signal) => <span key={signal} className="rounded-full px-2 py-0.5 font-body text-[10px] font-black" style={{ color: provider.accent, background: provider.bg }}>{signalLabel(signal)}</span>)}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => previewProviderConnection(provider.id)} className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[15px] bg-white font-body text-[13px] font-black text-[#6B21A8] shadow-[inset_0_0_0_1px_#DDD6FE]" data-testid={`button-provider-preview-${provider.id}`}>
                    {connected ? <Check size={15} /> : <ChevronRight size={15} />}
                    {connected ? t("settings.healthDevices.disconnectDemo", "Reset demo") : t("settings.healthDevices.previewConnected", "Preview connected state")}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {selectedSetup && (
        <DeviceSetupModal
          device={selectedSetup.device}
          model={selectedSetup.model}
          onClose={() => setSelectedSetup(null)}
          onReady={markDeviceReady}
        />
      )}
    </PhoneFrame>
  );
}
