import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

const GLOSSARY: { term: string; def: string }[] = [
  { term: "NIFTY 50",     def: "Benchmark index of 50 large-cap stocks listed on NSE, weighted by free-float market cap." },
  { term: "SENSEX",       def: "BSE's flagship index of 30 financially sound companies, also free-float weighted." },
  { term: "LTP",          def: "Last Traded Price — the price of the most recent trade." },
  { term: "P/E ratio",    def: "Price-to-Earnings: market price ÷ earnings per share. Indicates valuation." },
  { term: "P/B ratio",    def: "Price-to-Book: market price ÷ book value per share. Useful for asset-heavy companies." },
  { term: "EPS",          def: "Earnings per Share: net profit attributable to equity holders ÷ shares outstanding." },
  { term: "ROE",          def: "Return on Equity: net income ÷ shareholder equity. Measures profitability of capital employed." },
  { term: "ROCE",         def: "Return on Capital Employed: EBIT ÷ (total assets − current liabilities)." },
  { term: "Debt/Equity",  def: "Total debt ÷ shareholder equity. Lower is generally safer." },
  { term: "Market cap",   def: "Share price × total shares outstanding. Categorised as Large/Mid/Small cap." },
  { term: "Circuit limits", def: "Daily price bands set by exchanges (typically ±5%/10%/20%) to curb volatility." },
  { term: "Promoter",     def: "Founders or controlling shareholders who promoted the company." },
  { term: "FII / FPI",    def: "Foreign Institutional/Portfolio Investors — overseas funds investing in Indian markets." },
  { term: "DII",          def: "Domestic Institutional Investors — Indian mutual funds, insurance companies, pension funds." },
  { term: "AUM",          def: "Assets Under Management — total market value of investments a fund manages." },
  { term: "NAV",          def: "Net Asset Value — per-unit value of a mutual fund, recomputed daily after market close." },
  { term: "SIP",          def: "Systematic Investment Plan — fixed periodic contribution to a mutual fund (rupee-cost averaging)." },
  { term: "STP / SWP",    def: "Systematic Transfer/Withdrawal Plan — automated transfers in or out of a fund." },
  { term: "Expense ratio",def: "Annual cost of running the fund, expressed as % of AUM. Lower is better." },
  { term: "Exit load",    def: "Fee charged when redeeming units within a stipulated period (often 1% within 1 year)." },
  { term: "ELSS",         def: "Equity Linked Savings Scheme — tax-saving equity MF with 3-year lock-in (Sec 80C)." },
  { term: "Index fund",   def: "Passive fund that mirrors an index (e.g., NIFTY 50). Typically lowest expense ratio." }
];

const TAX_RULES = [
  {
    title: "Equity (stocks & equity MFs)",
    points: [
      "Short-term (≤12 months): STCG taxed at 15% under section 111A.",
      "Long-term (>12 months): LTCG above ₹1 lakh/yr taxed at 10% (no indexation) under section 112A.",
      "Listed equity STT-paid trades qualify for the above rates.",
      "Dividends are taxed at slab rate in the recipient's hands; TDS at 10% if dividend > ₹5,000."
    ]
  },
  {
    title: "Debt mutual funds (units acquired on/after 01-Apr-2023)",
    points: [
      "Capital gains taxed at slab rate regardless of holding period (section 50AA).",
      "Indexation benefit no longer available for debt MFs.",
      "Older holdings still follow the previous LTCG with indexation rule."
    ]
  },
  {
    title: "Hybrid & gold funds",
    points: [
      "Equity-oriented hybrid (≥65% equity): treated as equity for tax.",
      "Other hybrids and gold funds: taxed as debt MFs (slab rate from Apr 2023)."
    ]
  },
  {
    title: "Set-off & carry-forward",
    points: [
      "STCL can offset STCG and LTCG; LTCL can offset only LTCG.",
      "Unabsorbed losses can be carried forward for 8 assessment years."
    ]
  }
];

export default function Education() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Learn the basics</h1>
        <p className="text-sm text-slate-500 mt-1">Quick references for Indian markets and taxation.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Glossary</CardTitle></CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {GLOSSARY.map((g) => (
              <div key={g.term}>
                <dt className="font-medium">{g.term}</dt>
                <dd className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{g.def}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tax on stocks &amp; mutual funds</CardTitle></CardHeader>
        <CardBody className="space-y-5">
          {TAX_RULES.map((s) => (
            <section key={s.title}>
              <h3 className="font-medium">{s.title}</h3>
              <ul className="mt-1.5 list-disc list-inside text-sm text-slate-600 dark:text-slate-300 space-y-1">
                {s.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </section>
          ))}
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
            Information based on rules in force as of FY 2024-25 in India. Always confirm with your CA before filing.
            This page is for education only and is not tax advice.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
