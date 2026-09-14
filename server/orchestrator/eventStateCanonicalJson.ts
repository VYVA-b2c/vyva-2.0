import { createHash } from "node:crypto";

export const INTERACTION_EVENT_DIGEST_DOMAIN =
  "vyva.task7.interaction-event.semantic.v1" as const;
export const FLOW_STATE_DIGEST_DOMAIN =
  "vyva.task7.flow-state.semantic.v1" as const;
export const SHELL_EVENT_ID_DOMAIN =
  "vyva.task7.shell-delivery-event-id.v1" as const;

function ownEnumerableDataEntries(
  value: object,
  label: "Canonical JSON" | "Contract projection",
): Array<readonly [string, unknown]> {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(descriptors).map((key) => {
    if (typeof key !== "string") {
      throw new TypeError(`${label} does not support symbol keys`);
    }
    const descriptor = descriptors[key];
    if (!("value" in descriptor)) {
      throw new TypeError(`${label} does not support accessor properties`);
    }
    if (!descriptor.enumerable) {
      throw new TypeError(`${label} does not support non-enumerable properties`);
    }
    return [key, descriptor.value] as const;
  });
}

function denseArrayValues(
  value: unknown[],
  label: "Canonical JSON" | "Contract projection",
): unknown[] {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const values: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor) {
      throw new TypeError(`${label} does not support sparse arrays`);
    }
    if (!("value" in descriptor)) {
      throw new TypeError(`${label} does not support accessor properties`);
    }
    if (!descriptor.enumerable) {
      throw new TypeError(`${label} only supports ordinary array elements`);
    }
    values.push(descriptor.value);
  }
  const allowedKeys = new Set(["length", ...values.map((_, index) => String(index))]);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string" || !allowedKeys.has(key)) {
      throw new TypeError(`${label} only supports ordinary arrays`);
    }
  }
  return values;
}

function serialize(value: unknown, ancestors: Set<object>): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("Canonical JSON only supports finite numbers");
      return JSON.stringify(value);
    case "undefined":
    case "function":
    case "symbol":
    case "bigint":
      throw new TypeError(`Canonical JSON does not support ${typeof value}`);
    case "object":
      break;
    default:
      throw new TypeError("Canonical JSON received an unsupported value");
  }

  if (ancestors.has(value)) throw new TypeError("Canonical JSON does not support cyclic values");
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) throw new TypeError("Canonical JSON only supports ordinary arrays");
    const values = denseArrayValues(value, "Canonical JSON");
    ancestors.add(value);
    try {
      return `[${values.map((item) => serialize(item, ancestors)).join(",")}]`;
    } finally {
      ancestors.delete(value);
    }
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Canonical JSON only supports plain objects");
  }

  ancestors.add(value);
  try {
    return `{${ownEnumerableDataEntries(value, "Canonical JSON")
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${serialize(item, ancestors)}`)
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJson(value: unknown): string {
  return serialize(value, new Set());
}

function cloneInertValue(value: unknown, ancestors: Set<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Contract projection only supports finite numbers");
    return value;
  }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError("Contract projection only supports ordinary arrays");
    }
    if (ancestors.has(value)) throw new TypeError("Contract projection does not support cyclic values");
    const values = denseArrayValues(value, "Contract projection");
    ancestors.add(value);
    try {
      return values.map((item) => {
        if (item === undefined) throw new TypeError("Contract arrays cannot contain undefined");
        return cloneInertValue(item, ancestors);
      });
    } finally {
      ancestors.delete(value);
    }
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Contract projection only supports plain objects");
    }
    if (ancestors.has(value)) throw new TypeError("Contract projection does not support cyclic values");
    const entries = ownEnumerableDataEntries(value, "Contract projection");
    ancestors.add(value);
    try {
      return Object.fromEntries(
        entries.map(([key, item]) => {
          if (item === undefined) {
            throw new TypeError("Contract objects cannot contain undefined");
          }
          return [key, cloneInertValue(item, ancestors)];
        }),
      );
    } finally {
      ancestors.delete(value);
    }
  }
  throw new TypeError(`Contract projection does not support ${typeof value}`);
}

export function descriptorSafeDeepInertClone(value: unknown): unknown {
  return cloneInertValue(value, new Set());
}

export function canonicalContractProjection(value: unknown): unknown {
  return descriptorSafeDeepInertClone(value);
}

export function canonicalSha256(domain: string, value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(`${domain}\n${canonicalJson(value)}`, "utf8")
    .digest("hex")}`;
}

export function deterministicShellEventUuid(
  idempotencyReference: string,
  eventType: string,
): string {
  const digest = createHash("sha256")
    .update(`${SHELL_EVENT_ID_DOMAIN}\n${eventType}\n${idempotencyReference}`, "utf8")
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
