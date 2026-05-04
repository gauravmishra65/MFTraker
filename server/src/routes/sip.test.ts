/**
 * Pure-math test of the SIP future-value formula used in /mf/calc/sip.
 * We replicate the same formula here so the test runs without an HTTP server.
 */
function sipFutureValue(monthly: number, years: number, ratePctPerYear: number) {
  const months = Math.round(years * 12);
  const r = ratePctPerYear / 100 / 12;
  if (r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
}

describe("SIP calculator", () => {
  it("zero return: FV equals total contributed", () => {
    expect(Math.round(sipFutureValue(5000, 10, 0))).toBe(5000 * 12 * 10);
  });
  it("12% annualized 5000/m for 10y is roughly 11.6L", () => {
    const fv = sipFutureValue(5000, 10, 12);
    expect(fv).toBeGreaterThan(11_50_000);
    expect(fv).toBeLessThan(11_75_000);
  });
  it("higher rate produces higher FV", () => {
    expect(sipFutureValue(5000, 10, 15)).toBeGreaterThan(sipFutureValue(5000, 10, 8));
  });
});
