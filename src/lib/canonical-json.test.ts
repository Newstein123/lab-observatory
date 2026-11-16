import { describe, expect, it } from "vitest";
import { canonicalJson, deepEqualJson } from "./canonical-json";

describe("canonicalJson", () => {
  it("ignores key order at every depth", () => {
    expect(deepEqualJson({ a: 1, b: { c: 2, d: [1, { e: 1, f: 2 }] } }, { b: { d: [1, { f: 2, e: 1 }], c: 2 }, a: 1 })).toBe(true);
  });
  it("ignores undefined values but not nulls", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(deepEqualJson({ a: null }, {})).toBe(false);
  });
  it("detects real differences, including array order", () => {
    expect(deepEqualJson({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqualJson([1, 2], [2, 1])).toBe(false);
  });
});
