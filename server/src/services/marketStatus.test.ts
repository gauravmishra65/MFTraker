import { isMarketOpen } from "./marketStatus";

function ist(year: number, month: number, day: number, h: number, m: number) {
  // Construct "now in IST" by spoofing — pass a Date that, when read with
  // Date#getDay/Hours/Minutes in local TZ, equals the IST clock we want.
  // Tests invoke isMarketOpen(now) directly so timezone doesn't matter.
  const d = new Date(0);
  d.setFullYear(year, month - 1, day);
  d.setHours(h, m, 0, 0);
  return d;
}

describe("isMarketOpen", () => {
  it("closed on Saturday", () => {
    // 2025-04-05 was a Saturday
    expect(isMarketOpen(ist(2025, 4, 5, 11, 0))).toBe(false);
  });
  it("closed on Sunday", () => {
    expect(isMarketOpen(ist(2025, 4, 6, 11, 0))).toBe(false);
  });
  it("closed before 09:15 on a weekday", () => {
    // 2025-04-07 Monday
    expect(isMarketOpen(ist(2025, 4, 7, 8, 30))).toBe(false);
  });
  it("open at 11:00 on a weekday", () => {
    expect(isMarketOpen(ist(2025, 4, 7, 11, 0))).toBe(true);
  });
  it("open at 15:30 on the dot", () => {
    expect(isMarketOpen(ist(2025, 4, 7, 15, 30))).toBe(true);
  });
  it("closed at 15:31", () => {
    expect(isMarketOpen(ist(2025, 4, 7, 15, 31))).toBe(false);
  });
});
