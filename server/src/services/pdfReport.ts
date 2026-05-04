import PDFDocument from "pdfkit";
import { Response } from "express";
import { getEnrichedPortfolio } from "./portfolio";

const INR = (n: number) =>
  "Rs " + n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/**
 * Stream a styled portfolio report straight to the HTTP response.
 * Uses pdfkit (no external dependencies, ships pure JS).
 */
export async function streamPortfolioReport(userId: string, fullName: string, res: Response) {
  const data = await getEnrichedPortfolio(userId);
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=portfolio-${Date.now()}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).fillColor("#1c70de").text("Portfolio Report", { align: "left" });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#475569").text(
    `${fullName} • Generated ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
  );
  doc.moveDown(1);

  // Summary box
  const s = data.summary;
  const boxTop = doc.y;
  doc.rect(40, boxTop, 515, 70).fill("#f1f5f9");
  doc.fillColor("#0f172a");

  const cellWidth = 515 / 4;
  const labels: [string, string, string?][] = [
    ["Invested",      INR(s.invested)],
    ["Current value", INR(s.currentValue)],
    ["Overall P&L",   INR(s.pnl), `${s.pnlPct.toFixed(2)}%`],
    ["Day's change",  INR(s.dayChange)]
  ];
  labels.forEach(([label, value, sub], i) => {
    const x = 40 + cellWidth * i + 10;
    doc.fontSize(9).fillColor("#475569").text(label, x, boxTop + 10);
    doc.fontSize(13).fillColor("#0f172a").text(value, x, boxTop + 24);
    if (sub) doc.fontSize(9).fillColor(s.pnl >= 0 ? "#16a34a" : "#dc2626").text(sub, x, boxTop + 46);
  });

  doc.fillColor("#0f172a");
  doc.y = boxTop + 90;

  // Holdings table
  doc.fontSize(12).text("Holdings", 40, doc.y);
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const cols = [
    { label: "Symbol", x: 40,  w: 80,  align: "left" as const },
    { label: "Qty",    x: 120, w: 50,  align: "right" as const },
    { label: "Avg",    x: 170, w: 70,  align: "right" as const },
    { label: "LTP",    x: 240, w: 70,  align: "right" as const },
    { label: "Invested", x: 310, w: 80, align: "right" as const },
    { label: "Value",  x: 390, w: 80,  align: "right" as const },
    { label: "P&L",    x: 470, w: 85,  align: "right" as const }
  ];

  doc.fontSize(9).fillColor("#475569");
  cols.forEach((c) => doc.text(c.label, c.x, tableTop, { width: c.w, align: c.align }));
  doc.moveTo(40, tableTop + 14).lineTo(555, tableTop + 14).strokeColor("#cbd5e1").stroke();

  let y = tableTop + 20;
  doc.fillColor("#0f172a").fontSize(9);

  for (const h of data.holdings) {
    if (y > 770) {
      doc.addPage();
      y = 40;
    }
    doc.text(h.symbol, cols[0].x, y, { width: cols[0].w });
    doc.text(String(h.quantity), cols[1].x, y, { width: cols[1].w, align: "right" });
    doc.text(INR(h.avgPrice), cols[2].x, y, { width: cols[2].w, align: "right" });
    doc.text(INR(h.ltp), cols[3].x, y, { width: cols[3].w, align: "right" });
    doc.text(INR(h.invested), cols[4].x, y, { width: cols[4].w, align: "right" });
    doc.text(INR(h.currentValue), cols[5].x, y, { width: cols[5].w, align: "right" });
    doc.fillColor(h.pnl >= 0 ? "#16a34a" : "#dc2626")
      .text(`${INR(h.pnl)} (${h.pnlPct.toFixed(2)}%)`, cols[6].x, y, { width: cols[6].w, align: "right" });
    doc.fillColor("#0f172a");
    y += 18;
  }

  if (data.holdings.length === 0) {
    doc.fontSize(10).fillColor("#64748b").text("No holdings yet.", 40, y + 8);
  }

  // Footer
  doc.fontSize(8).fillColor("#94a3b8").text(
    "MF & Share Tracker  •  Prices via Yahoo Finance  •  This is informational, not advice.",
    40, 800, { width: 515, align: "center" }
  );

  doc.end();
}
