import { describe, expect, it } from "vitest";
import {
  canonicalContractProjection,
  canonicalJson,
  canonicalSha256,
  descriptorSafeDeepInertClone,
  FLOW_STATE_DIGEST_DOMAIN,
  INTERACTION_EVENT_DIGEST_DOMAIN,
} from "./eventStateCanonicalJson.js";

describe("Task 7 canonical JSON", () => {
  it("sorts object keys recursively while preserving arrays", () => {
    const left = { b: 2, nested: { z: true, a: [{ y: 2, x: 1 }, 3] }, a: 1 };
    const right = { a: 1, nested: { a: [{ x: 1, y: 2 }, 3], z: true }, b: 2 };
    const expected = '{"a":1,"b":2,"nested":{"a":[{"x":1,"y":2},3],"z":true}}';
    expect(canonicalJson(left)).toBe(expected);
    expect(canonicalJson(right)).toBe(expected);
    expect(canonicalJson({ values: [1, 2] })).not.toBe(canonicalJson({ values: [2, 1] }));
  });

  it("preserves null-versus-absent and meaningful scalar differences", () => {
    expect(canonicalJson({ value: null })).toBe('{"value":null}');
    expect(canonicalJson({})).toBe("{}");
    expect(canonicalJson({ value: 1 })).not.toBe(canonicalJson({ value: 2 }));
  });

  it("rejects explicit undefined object values instead of projecting absence", () => {
    expect(() => canonicalContractProjection({ value: undefined }))
      .toThrow("Contract objects cannot contain undefined");
    expect(() => descriptorSafeDeepInertClone({ value: undefined }))
      .toThrow("Contract objects cannot contain undefined");
    expect(() => descriptorSafeDeepInertClone({ nested: { value: undefined } }))
      .toThrow("Contract objects cannot contain undefined");
  });

  it("uses record-kind domain separation", () => {
    const value = { a: 1 };
    expect(canonicalSha256(INTERACTION_EVENT_DIGEST_DOMAIN, value))
      .not.toBe(canonicalSha256(FLOW_STATE_DIGEST_DOMAIN, value));
  });

  it.each([
    ["undefined object value", { value: undefined }],
    ["undefined array value", [undefined]],
    ["function", { value: () => undefined }],
    ["symbol", { value: Symbol("x") }],
    ["bigint", { value: BigInt(1) }],
    ["NaN", { value: Number.NaN }],
    ["positive infinity", { value: Number.POSITIVE_INFINITY }],
    ["negative infinity", { value: Number.NEGATIVE_INFINITY }],
    ["class instance", new (class Unsupported { value = 1; })()],
  ])("rejects %s", (_label, value) => {
    expect(() => canonicalJson(value)).toThrow(TypeError);
  });

  it("rejects cycles", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expect(() => canonicalJson(value)).toThrow(TypeError);
  });

  it("rejects sparse arrays without colliding with dense arrays", () => {
    const sparse = Array(1);
    const partiallySparse = [1, 2];
    delete partiallySparse[0];
    expect(canonicalJson([])).toBe("[]");
    expect(() => canonicalJson(sparse)).toThrow("sparse arrays");
    expect(() => canonicalJson(partiallySparse)).toThrow("sparse arrays");
    expect(() => canonicalContractProjection(sparse)).toThrow("sparse arrays");
  });

  it("rejects accessors without invoking getters or setters", () => {
    let getterCalls = 0;
    let setterCalls = 0;
    const accessorObject = Object.defineProperties({}, {
      getter: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return "must-not-run";
        },
      },
      setter: {
        enumerable: true,
        set(_value: unknown) {
          setterCalls += 1;
        },
      },
    });
    const accessorArray = [1];
    Object.defineProperty(accessorArray, "0", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return 1;
      },
    });

    expect(() => canonicalJson(accessorObject)).toThrow("accessor properties");
    expect(() => canonicalContractProjection(accessorObject))
      .toThrow("accessor properties");
    expect(() => canonicalJson(accessorArray)).toThrow("accessor properties");
    expect(() => canonicalContractProjection(accessorArray))
      .toThrow("accessor properties");
    expect(() => descriptorSafeDeepInertClone(accessorObject))
      .toThrow("accessor properties");
    expect(getterCalls).toBe(0);
    expect(setterCalls).toBe(0);
  });

  it("returns a detached deep inert clone", () => {
    const nested = { value: "original" };
    const source = { nested, values: [nested] };
    const clone = descriptorSafeDeepInertClone(source) as typeof source;
    expect(clone).toEqual(source);
    expect(clone).not.toBe(source);
    expect(clone.nested).not.toBe(nested);
    expect(clone.values).not.toBe(source.values);
    expect(clone.values[0]).not.toBe(nested);
  });

  it("does not mutate input and is repeatable", () => {
    const value = { z: { b: 2, a: 1 }, a: [{ d: 4, c: 3 }] };
    const before = JSON.stringify(value);
    const first = canonicalJson(value);
    expect(canonicalJson(value)).toBe(first);
    expect(JSON.stringify(value)).toBe(before);
  });
});
