import { describe, expect, it } from "vitest";
import { linkError } from "./link-error";

describe("auth email link errors", () => {
  it("reads the description from the query", () => {
    expect(linkError({ search: "?error=access_denied&error_description=Email+link+is+invalid+or+has+expired", hash: "" })).toBe(
      "Email link is invalid or has expired",
    );
  });
  it("reads it from the hash", () => {
    expect(linkError({ search: "", hash: "#error=access_denied&error_code=otp_expired&error_description=Link%20expired" })).toBe("Link expired");
  });
  it("is undefined for a good link", () => {
    expect(linkError({ search: "?code=abc", hash: "" })).toBeUndefined();
  });
});
