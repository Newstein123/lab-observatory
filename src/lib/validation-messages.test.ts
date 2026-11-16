import { describe, expect, it } from "vitest";
import { z } from "zod";
import { friendlyMessage } from "./validation-messages";

const msg = (schema: z.ZodType, value: unknown) => {
  const r = schema.safeParse(value);
  if (r.success) throw new Error("expected failure");
  return friendlyMessage(r.error.issues[0].message);
};

describe("friendlyMessage", () => {
  const n = z.number().finite().min(10).max(10_000);
  it("explains range errors", () => {
    expect(msg(n, 0)).toBe("Must be at least 10");
    expect(msg(n, 20_000)).toBe("Must be at most 10,000");
  });
  it("explains missing and non-numeric values", () => {
    expect(msg(n, undefined)).toBe("Required");
    expect(msg(n, Number.NaN)).toBe("Enter a number");
  });
  it("passes other messages through", () => {
    expect(friendlyMessage("Name is required")).toBe("Name is required");
  });
});
