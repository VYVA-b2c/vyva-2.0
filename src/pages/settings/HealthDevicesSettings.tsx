import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bluetooth,
  Check,
  ChevronRight,
  Heart,
  Loader2,
  Scale,
  Stethoscope,
  Thermometer,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { VITALS_DEVICE_CATALOG, type VitalsDeviceCatalogItem, type VitalsDeviceKind } from "@/lib/vitalsDeviceCatalog";
import {
  isWebBluetoothSupported,
  readStandardBluetoothDevice,
  type BluetoothCaptureState,
} from "@/lib/vitalsBluetooth";
import { VITALS_SIGNAL_CATALOG } from "../../../shared/vitalsSignalCatalog";
import { formatVitalsReadingDisplay, type ProposedVitalsReading } from "../../../shared/vitalsParsing";

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

function signalLabel(signal: string) {
  return VITALS_SIGNAL_CATALOG[signal as keyof typeof VITALS_SIGNAL_CATALOG]?.shortLabel ?? signal;
}

function DeviceSetupModal({
  device,
  onClose,
  onReady,
}: {
  device: VitalsDeviceCatalogItem;
  onClose: () => void;
  onReady: (device: StoredHealthDevice) => Promise<void>;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [state, setState] = useState<BluetoothCaptureState>(isWebBluetoothSupported() ? "supported" : "unsupported");
  const [readings, setReadings] = useState<ProposedVitalsReading[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const Icon = DEVICE_ICON_BY_ID[device.id];
  const isBusy = state === "searching" || state === "connected" || state === "waiting";

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
    setError("");
    try {
      const result = await readStandardBluetoothDevice(device, setState);
      setReadings(result.readings);
      setDeviceName(result.deviceName);
    } catch (err) {
      setState(isWebBluetoothSupported() ? "failed" : "unsupported");
      setError(err instanceof Error ? err.message : t("settings.healthDevices.bluetooth.failedShort", "Bluetooth read failed."));
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
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 px-0" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <section className="max-h-[90vh] w-full max-w-[620px] overflow-y-auto rounded-t-[30px] bg-white px-5 pb-8 pt-4 shadow-[0_-16px_40px_rgba(31,24,18,0.18)]" data-testid="health-device-setup-modal">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#E8DED4]" />
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]" style={{ color: device.accent, background: device.bg }}>
              <Icon size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[26px] italic leading-tight text-vyva-text-1">{device.label}</h2>
              <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">{device.helper}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
          >
            <X size={18} />
          </button>
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
            className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#6B21A8] px-4 font-body text-[16px] font-black text-white shadow-[0_12px_24px_rgba(107,33,168,0.18)] disabled:bg-[#D8CDE2] disabled:text-white"
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
              className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#047857] px-4 font-body text-[16px] font-black text-white disabled:opacity-60"
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
              className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[16px] bg-white px-3 font-body text-[14px] font-black text-[#6B21A8] shadow-[inset_0_0_0_1px_#DDD6FE]"
              data-testid="button-health-device-open-vitals-from-modal"
            >
              {t("settings.healthDevices.openVitals", "Open Vitals")}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function HealthDevicesSettings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedDevice, setSelectedDevice] = useState<VitalsDeviceCatalogItem | null>(null);
  const [deviceActionError, setDeviceActionError] = useState("");
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

        <section className="rounded-[24px] border border-[#EFE4D5] bg-white p-4 shadow-[0_10px_26px_rgba(53,28,87,0.055)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-text-2">
                {t("settings.healthDevices.bluetoothSection", "Bluetooth devices")}
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
            {VITALS_DEVICE_CATALOG.map((device) => {
              const Icon = DEVICE_ICON_BY_ID[device.id];
              const stored = readyById.get(device.id);
              return (
                <article
                  key={device.id}
                  className="rounded-[20px] border border-[#F0E7DE] bg-[#FFFCF8] p-3 shadow-[0_5px_14px_rgba(63,45,35,0.035)]"
                  data-testid={`device-settings-card-${device.id}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px]" style={{ color: device.accent, background: device.bg }}>
                      <Icon size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-body text-[15px] font-black leading-tight text-vyva-text-1">{device.label}</p>
                        <span
                          className={`flex-shrink-0 rounded-full px-2 py-0.5 font-body text-[10px] font-black ${stored ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#F7F1E9] text-vyva-text-2"}`}
                          data-testid={`health-device-status-${device.id}`}
                        >
                          {stored ? t("settings.healthDevices.ready", "Ready") : t("settings.healthDevices.notSet", "Not set")}
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
                  {stored?.deviceName && (
                    <p className="mt-2 rounded-[14px] bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-bold text-[#047857]">
                      {t("settings.healthDevices.lastReady", { defaultValue: "Last checked: {{name}}", name: stored.deviceName })}
                    </p>
                  )}
                  <div className={`mt-3 grid gap-2 ${stored ? "grid-cols-[1fr_auto]" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedDevice(device)}
                      className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[15px] bg-white font-body text-[13px] font-black text-[#6B21A8] shadow-[inset_0_0_0_1px_#DDD6FE]"
                      data-testid={`button-health-device-setup-${device.id}`}
                    >
                      <Bluetooth size={15} />
                      {stored ? t("settings.healthDevices.testAgain", "Test again") : t("settings.healthDevices.setUp", "Set up")}
                    </button>
                    {stored && (
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
        </section>
      </div>

      {selectedDevice && (
        <DeviceSetupModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onReady={markDeviceReady}
        />
      )}
    </PhoneFrame>
  );
}
