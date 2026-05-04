import { hashPassword, isStrongPassword, verifyPassword } from "./password";

describe("isStrongPassword", () => {
  it("rejects passwords shorter than 8 chars", () => {
    expect(isStrongPassword("Aa1!")).toBe(false);
  });
  it("rejects without uppercase", () => {
    expect(isStrongPassword("abcdef1!")).toBe(false);
  });
  it("rejects without digit", () => {
    expect(isStrongPassword("Abcdefg!")).toBe(false);
  });
  it("rejects without special char", () => {
    expect(isStrongPassword("Abcdef12")).toBe(false);
  });
  it("accepts a strong password", () => {
    expect(isStrongPassword("Demo@1234")).toBe(true);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips correctly", async () => {
    const hash = await hashPassword("Demo@1234");
    expect(hash).not.toEqual("Demo@1234");
    expect(await verifyPassword("Demo@1234", hash)).toBe(true);
    expect(await verifyPassword("Wrong@1234", hash)).toBe(false);
  });
});
