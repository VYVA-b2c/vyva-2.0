import type { ProposedVitalsReading } from "../../shared/vitalsParsing";
import { buildProposedVitalsReading } from "../../shared/vitalsParsing";
import type { VitalsSignalKey } from "../../shared/vitalsSignalCatalog";
import type { VitalsDeviceCatalogItem, VitalsDeviceModel } from "./vitalsDeviceCatalog";

export type BluetoothCaptureState =
  | "supported"
  | "unsupported"
  | "searching"
  | "connected"
  | "waiting"
  | "reading_found"
  | "needs_confirmation"
  | "failed";

export type ParsedBluetoothReading = {
  signalType: VitalsSignalKey;
  value: number;
  explanation: string;
  contextTag?: string;
};

export type BluetoothReadResult = {
  deviceName: string;
  serviceUuid: number;
  characteristicUuid: number;
  parserVersion: string;
  modelId?: string;
  supportLevel: "pilot_candidate" | "tested" | "experimental";
  readings: ProposedVitalsReading[];
};

export type BluetoothReadErrorCode =
  | "unsupported"
  | "user_cancelled"
  | "connection_failed"
  | "service_unavailable"
  | "measurement_timeout"
  | "empty_measurement"
  | "parse_failed";

export class BluetoothReadError extends Error {
  readonly code: BluetoothReadErrorCode;

  constructor(code: BluetoothReadErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BluetoothReadError";
    this.code = code;
  }
}

export function bluetoothReadErrorCode(error: unknown): BluetoothReadErrorCode | null {
  return error instanceof BluetoothReadError ? error.code : null;
}

type BluetoothRequestOptions = {
  filters?: Array<{ services: number[] }>;
  optionalServices?: number[];
};

type BluetoothCharacteristicLike = {
  uuid?: string;
  value?: DataView;
  readValue: () => Promise<DataView>;
  startNotifications?: () => Promise<BluetoothCharacteristicLike>;
  addEventListener?: (type: "characteristicvaluechanged", listener: (event: Event) => void) => void;
  removeEventListener?: (type: "characteristicvaluechanged", listener: (event: Event) => void) => void;
};

type BluetoothServiceLike = {
  getCharacteristic: (characteristic: number) => Promise<BluetoothCharacteristicLike>;
};

type BluetoothServerLike = {
  getPrimaryService: (service: number) => Promise<BluetoothServiceLike>;
};

type BluetoothDeviceLike = {
  id?: string;
  name?: string;
  gatt?: {
    connect: () => Promise<BluetoothServerLike>;
  };
};

type NavigatorWithBluetooth = Navigator & {
  bluetooth?: {
    requestDevice: (options: BluetoothRequestOptions) => Promise<BluetoothDeviceLike>;
  };
};

export const VITALS_BLUETOOTH_PARSER_VERSION = "vyva-ble-standard-gatt-v1";
const NOTIFICATION_TIMEOUT_MS = 20_000;

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function ieee11073SFloat(view: DataView, offset: number): number {
  const raw = view.getUint16(offset, true);
  let mantissa = raw & 0x0fff;
  let exponent = raw >> 12;
  if (mantissa >= 0x0800) mantissa -= 0x1000;
  if (exponent >= 0x08) exponent -= 0x10;
  return mantissa * Math.pow(10, exponent);
}

function ieee11073Float(view: DataView, offset: number): number {
  const raw = view.getUint32(offset, true);
  let mantissa = raw & 0x00ffffff;
  let exponent = raw >> 24;
  if (mantissa >= 0x00800000) mantissa -= 0x01000000;
  if (exponent >= 0x80) exponent -= 0x100;
  return mantissa * Math.pow(10, exponent);
}

function fahrenheitToCelsius(value: number) {
  return (value - 32) * 5 / 9;
}

function kgPerLToMgDl(value: number) {
  return value * 100000;
}

function molPerLToMgDl(value: number) {
  return value * 18015.588;
}

function hasBytes(view: DataView, offset: number, bytes: number) {
  return view.byteLength >= offset + bytes;
}

export function parseHeartRateMeasurement(view: DataView): ParsedBluetoothReading[] {
  if (!hasBytes(view, 0, 2)) return [];
  const flags = view.getUint8(0);
  const is16Bit = Boolean(flags & 0x01);
  if (!hasBytes(view, 1, is16Bit ? 2 : 1)) return [];
  const value = is16Bit ? view.getUint16(1, true) : view.getUint8(1);
  return [{ signalType: "resting_hr_bpm", value, explanation: "Heart-rate monitor reading detected.", contextTag: "resting" }];
}

export function parseBloodPressureMeasurement(view: DataView): ParsedBluetoothReading[] {
  if (!hasBytes(view, 0, 7)) return [];
  const flags = view.getUint8(0);
  const isKpa = Boolean(flags & 0x01);
  const systolicRaw = ieee11073SFloat(view, 1);
  const diastolicRaw = ieee11073SFloat(view, 3);
  const convert = (value: number) => roundOne(isKpa ? value * 7.50062 : value);
  const readings: ParsedBluetoothReading[] = [
    { signalType: "bp_systolic", value: convert(systolicRaw), explanation: "Blood pressure top number from cuff.", contextTag: "general" },
    { signalType: "bp_diastolic", value: convert(diastolicRaw), explanation: "Blood pressure bottom number from cuff.", contextTag: "general" },
  ];

  let offset = 7;
  if (flags & 0x02) offset += 7;
  if ((flags & 0x04) && hasBytes(view, offset, 2)) {
    const pulse = roundOne(ieee11073SFloat(view, offset));
    readings.push({ signalType: "resting_hr_bpm", value: pulse, explanation: "Pulse from blood pressure cuff.", contextTag: "resting" });
  }

  return readings;
}

export function parseThermometerMeasurement(view: DataView): ParsedBluetoothReading[] {
  if (!hasBytes(view, 0, 5)) return [];
  const flags = view.getUint8(0);
  const isFahrenheit = Boolean(flags & 0x01);
  const raw = ieee11073Float(view, 1);
  const value = roundOne(isFahrenheit ? fahrenheitToCelsius(raw) : raw);
  return [{ signalType: "temperature_c", value, explanation: "Thermometer reading detected.", contextTag: "general" }];
}

export function parseGlucoseMeasurement(view: DataView): ParsedBluetoothReading[] {
  if (!hasBytes(view, 0, 10)) return [];
  const flags = view.getUint8(0);
  let offset = 1 + 2 + 7;
  if (flags & 0x01) offset += 2;
  if (!(flags & 0x02) || !hasBytes(view, offset, 2)) return [];
  const concentration = ieee11073SFloat(view, offset);
  const usesMolPerL = Boolean(flags & 0x04);
  const value = roundOne(usesMolPerL ? molPerLToMgDl(concentration) : kgPerLToMgDl(concentration));
  return [{ signalType: "glucose_mgdl", value, explanation: "Glucose meter reading detected.", contextTag: "general" }];
}

export function parseCgmMeasurement(view: DataView): ParsedBluetoothReading[] {
  if (!hasBytes(view, 2, 2)) return [];
  const concentration = ieee11073SFloat(view, 2);
  const value = roundOne(concentration <= 25 ? concentration * 18.0182 : concentration);
  return [{ signalType: "glucose_mgdl", value, explanation: "CGM glucose reading detected.", contextTag: "general" }];
}

export function parseWeightScaleMeasurement(view: DataView): ParsedBluetoothReading[] {
  if (!hasBytes(view, 0, 3)) return [];
  const flags = view.getUint8(0);
  const isImperial = Boolean(flags & 0x01);
  const raw = view.getUint16(1, true);
  const kg = isImperial ? raw * 0.01 * 0.45359237 : raw * 0.005;
  return [{ signalType: "weight_kg", value: roundOne(kg), explanation: "Scale reading detected.", contextTag: "general" }];
}

export function parsePulseOximeterMeasurement(view: DataView): ParsedBluetoothReading[] {
  if (!hasBytes(view, 0, 5)) return [];
  const spo2 = roundOne(ieee11073SFloat(view, 1));
  const pulse = roundOne(ieee11073SFloat(view, 3));
  return [
    { signalType: "oxygen_saturation", value: spo2, explanation: "Oxygen saturation from pulse oximeter.", contextTag: "resting" },
    { signalType: "resting_hr_bpm", value: pulse, explanation: "Pulse from oximeter.", contextTag: "resting" },
  ];
}

export function parseBluetoothCharacteristic(characteristicUuid: number, value: DataView): ParsedBluetoothReading[] {
  switch (characteristicUuid) {
    case 0x2a37:
      return parseHeartRateMeasurement(value);
    case 0x2a35:
      return parseBloodPressureMeasurement(value);
    case 0x2a1c:
      return parseThermometerMeasurement(value);
    case 0x2a18:
      return parseGlucoseMeasurement(value);
    case 0x2aa7:
      return parseCgmMeasurement(value);
    case 0x2a9d:
      return parseWeightScaleMeasurement(value);
    case 0x2a5e:
    case 0x2a5f:
      return parsePulseOximeterMeasurement(value);
    default:
      return [];
  }
}

function bluetoothSourceRef(params: {
  device: VitalsDeviceCatalogItem;
  model?: VitalsDeviceModel;
  serviceUuid: number;
  characteristicUuid: number;
  deviceName: string;
}) {
  return {
    provider: "web_bluetooth",
    device_type: params.device.id,
    device_label: params.device.label,
    device_name: params.deviceName,
    model_id: params.model?.id,
    model_label: params.model?.label,
    support_level: params.model?.supportLevel ?? "experimental",
    service_uuid: `0x${params.serviceUuid.toString(16)}`,
    characteristic_uuid: `0x${params.characteristicUuid.toString(16)}`,
    parser_version: VITALS_BLUETOOTH_PARSER_VERSION,
  };
}

export function buildBluetoothProposedReadings(params: {
  device: VitalsDeviceCatalogItem;
  model?: VitalsDeviceModel;
  parsed: ParsedBluetoothReading[];
  serviceUuid: number;
  characteristicUuid: number;
  deviceName: string;
  now?: Date;
}): ProposedVitalsReading[] {
  const sourceRef = bluetoothSourceRef(params);
  return params.parsed
    .map((reading) => buildProposedVitalsReading(
      reading.signalType,
      reading.value,
      reading.explanation,
      {
        source: "connected_device",
        captureMethod: "web_bluetooth",
        confidence: "high",
        now: params.now ?? new Date(),
        contextTag: reading.contextTag,
        sourceRef,
      },
    ))
    .filter((reading): reading is ProposedVitalsReading => Boolean(reading));
}

async function readCharacteristicValue(characteristic: BluetoothCharacteristicLike): Promise<DataView> {
  try {
    const value = await characteristic.readValue();
    if (!value.byteLength) {
      throw new BluetoothReadError("empty_measurement", "The Bluetooth device returned an empty measurement.");
    }
    return value;
  } catch (readError) {
    if (readError instanceof BluetoothReadError) throw readError;
    if (!characteristic.startNotifications || !characteristic.addEventListener) {
      throw new BluetoothReadError("connection_failed", "Could not read from this Bluetooth device.", { cause: readError });
    }
    try {
      await characteristic.startNotifications();
    } catch (notificationError) {
      throw new BluetoothReadError("connection_failed", "Could not start Bluetooth measurement notifications.", { cause: notificationError });
    }
    return new Promise<DataView>((resolve, reject) => {
      const timer = globalThis.setTimeout(() => {
        characteristic.removeEventListener?.("characteristicvaluechanged", handler);
        reject(new BluetoothReadError("measurement_timeout", "Timed out waiting for a Bluetooth measurement."));
      }, NOTIFICATION_TIMEOUT_MS);
      const handler = (event: Event) => {
        globalThis.clearTimeout(timer);
        characteristic.removeEventListener?.("characteristicvaluechanged", handler);
        const target = event.target as BluetoothCharacteristicLike | null;
        if (target?.value?.byteLength) resolve(target.value);
        else reject(new BluetoothReadError("empty_measurement", "The Bluetooth device returned an empty measurement."));
      };
      characteristic.addEventListener("characteristicvaluechanged", handler);
    });
  }
}

export function isWebBluetoothSupported() {
  return typeof navigator !== "undefined" && Boolean((navigator as NavigatorWithBluetooth).bluetooth?.requestDevice);
}

export async function readStandardBluetoothDevice(
  device: VitalsDeviceCatalogItem,
  onState?: (state: BluetoothCaptureState) => void,
  model?: VitalsDeviceModel,
): Promise<BluetoothReadResult> {
  const bluetooth = (navigator as NavigatorWithBluetooth).bluetooth;
  if (!bluetooth?.requestDevice) {
    onState?.("unsupported");
    throw new BluetoothReadError("unsupported", "Bluetooth is not available in this browser.");
  }

  const services = model?.bleServices ?? device.bleServices;
  const characteristics = model?.bleCharacteristics ?? device.bleCharacteristics;

  onState?.("searching");
  let bluetoothDevice: BluetoothDeviceLike;
  try {
    bluetoothDevice = await bluetooth.requestDevice({
      filters: services.map((serviceUuid) => ({ services: [serviceUuid] })),
      optionalServices: services,
    });
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name === "NotFoundError") {
      throw new BluetoothReadError("user_cancelled", "Device selection was cancelled.", { cause: error });
    }
    throw new BluetoothReadError("connection_failed", "Could not start Bluetooth device setup.", { cause: error });
  }

  let server: BluetoothServerLike | undefined;
  try {
    server = await bluetoothDevice.gatt?.connect();
  } catch (error) {
    throw new BluetoothReadError("connection_failed", "Could not connect to this Bluetooth device.", { cause: error });
  }
  if (!server) throw new BluetoothReadError("connection_failed", "Could not connect to this Bluetooth device.");
  onState?.("connected");

  let foundService = false;
  let foundCharacteristic = false;
  let lastReadError: BluetoothReadError | null = null;

  for (const serviceUuid of services) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      foundService = true;
      for (const characteristicUuid of characteristics) {
        try {
          const characteristic = await service.getCharacteristic(characteristicUuid);
          foundCharacteristic = true;
          onState?.("waiting");
          const value = await readCharacteristicValue(characteristic);
          const parsed = parseBluetoothCharacteristic(characteristicUuid, value);
          if (!parsed.length) {
            lastReadError = new BluetoothReadError("parse_failed", "The Bluetooth measurement format was not recognised.");
            continue;
          }
          const readings = buildBluetoothProposedReadings({
            device,
            model,
            parsed,
            serviceUuid,
            characteristicUuid,
            deviceName: bluetoothDevice.name || device.label,
          });
          if (readings.length > 0) {
            onState?.("reading_found");
            onState?.("needs_confirmation");
            return {
              deviceName: bluetoothDevice.name || device.label,
              serviceUuid,
              characteristicUuid,
              parserVersion: VITALS_BLUETOOTH_PARSER_VERSION,
              modelId: model?.id,
              supportLevel: model?.supportLevel ?? "experimental",
              readings,
            };
          }
        } catch (error) {
          if (error instanceof BluetoothReadError) lastReadError = error;
          // Try the next characteristic or service.
        }
      }
    } catch {
      // Try the next supported service for this device class.
    }
  }

  onState?.("failed");
  if (lastReadError) throw lastReadError;
  if (!foundService || !foundCharacteristic) {
    throw new BluetoothReadError("service_unavailable", "This device did not expose the expected standard Bluetooth measurement service.");
  }
  throw new BluetoothReadError("parse_failed", "No supported Bluetooth measurement was found.");
}
