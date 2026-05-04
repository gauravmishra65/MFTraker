import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const STOCKS = [
  { symbol: "RELIANCE",  yahooSymbol: "RELIANCE.NS",  name: "Reliance Industries Ltd",       sector: "Energy",            capCategory: "LARGE", isin: "INE002A01018" },
  { symbol: "TCS",       yahooSymbol: "TCS.NS",       name: "Tata Consultancy Services Ltd", sector: "IT",                capCategory: "LARGE", isin: "INE467B01029" },
  { symbol: "HDFCBANK",  yahooSymbol: "HDFCBANK.NS",  name: "HDFC Bank Ltd",                  sector: "Financials",        capCategory: "LARGE", isin: "INE040A01034" },
  { symbol: "INFY",      yahooSymbol: "INFY.NS",      name: "Infosys Ltd",                    sector: "IT",                capCategory: "LARGE", isin: "INE009A01021" },
  { symbol: "ICICIBANK", yahooSymbol: "ICICIBANK.NS", name: "ICICI Bank Ltd",                 sector: "Financials",        capCategory: "LARGE", isin: "INE090A01021" },
  { symbol: "HINDUNILVR",yahooSymbol: "HINDUNILVR.NS",name: "Hindustan Unilever Ltd",         sector: "FMCG",              capCategory: "LARGE", isin: "INE030A01027" },
  { symbol: "BHARTIARTL",yahooSymbol: "BHARTIARTL.NS",name: "Bharti Airtel Ltd",              sector: "Telecom",           capCategory: "LARGE", isin: "INE397D01024" },
  { symbol: "ITC",       yahooSymbol: "ITC.NS",       name: "ITC Ltd",                        sector: "FMCG",              capCategory: "LARGE", isin: "INE154A01025" },
  { symbol: "SBIN",      yahooSymbol: "SBIN.NS",      name: "State Bank of India",            sector: "Financials",        capCategory: "LARGE", isin: "INE062A01020" },
  { symbol: "LT",        yahooSymbol: "LT.NS",        name: "Larsen & Toubro Ltd",            sector: "Construction",      capCategory: "LARGE", isin: "INE018A01030" },
  { symbol: "KOTAKBANK", yahooSymbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank Ltd",        sector: "Financials",        capCategory: "LARGE", isin: "INE237A01028" },
  { symbol: "AXISBANK",  yahooSymbol: "AXISBANK.NS",  name: "Axis Bank Ltd",                  sector: "Financials",        capCategory: "LARGE", isin: "INE238A01034" },
  { symbol: "MARUTI",    yahooSymbol: "MARUTI.NS",    name: "Maruti Suzuki India Ltd",        sector: "Auto",              capCategory: "LARGE", isin: "INE585B01010" },
  { symbol: "TATAMOTORS",yahooSymbol: "TATAMOTORS.NS",name: "Tata Motors Ltd",                sector: "Auto",              capCategory: "LARGE", isin: "INE155A01022" },
  { symbol: "WIPRO",     yahooSymbol: "WIPRO.NS",     name: "Wipro Ltd",                      sector: "IT",                capCategory: "LARGE", isin: "INE075A01022" },
  { symbol: "ASIANPAINT",yahooSymbol: "ASIANPAINT.NS",name: "Asian Paints Ltd",               sector: "Consumer",          capCategory: "LARGE", isin: "INE021A01026" },
  { symbol: "SUNPHARMA", yahooSymbol: "SUNPHARMA.NS", name: "Sun Pharmaceutical Industries",  sector: "Pharma",            capCategory: "LARGE", isin: "INE044A01036" },
  { symbol: "TITAN",     yahooSymbol: "TITAN.NS",     name: "Titan Company Ltd",              sector: "Consumer",          capCategory: "LARGE", isin: "INE280A01028" },
  { symbol: "BAJFINANCE",yahooSymbol: "BAJFINANCE.NS",name: "Bajaj Finance Ltd",              sector: "Financials",        capCategory: "LARGE", isin: "INE296A01024" },
  { symbol: "ADANIENT",  yahooSymbol: "ADANIENT.NS",  name: "Adani Enterprises Ltd",          sector: "Diversified",       capCategory: "LARGE", isin: "INE423A01024" },
  { symbol: "NESTLEIND", yahooSymbol: "NESTLEIND.NS", name: "Nestle India Ltd",               sector: "FMCG",              capCategory: "LARGE", isin: "INE239A01016" },
  { symbol: "ULTRACEMCO",yahooSymbol: "ULTRACEMCO.NS",name: "UltraTech Cement Ltd",           sector: "Cement",            capCategory: "LARGE", isin: "INE481G01011" },
  { symbol: "HCLTECH",   yahooSymbol: "HCLTECH.NS",   name: "HCL Technologies Ltd",           sector: "IT",                capCategory: "LARGE", isin: "INE860A01027" }
];

const FUNDS = [
  { schemeCode: "120503", name: "Axis Bluechip Fund - Direct Growth",            amc: "Axis MF",        category: "Equity", subCategory: "Large Cap", riskLevel: "Very High", expenseRatio: 0.6,  aum: 53000, minSip: 500,  minLumpsum: 5000, fundManager: "Shreyash Devalkar" },
  { schemeCode: "120465", name: "Mirae Asset Large Cap Fund - Direct Growth",    amc: "Mirae Asset MF", category: "Equity", subCategory: "Large Cap", riskLevel: "Very High", expenseRatio: 0.5,  aum: 38500, minSip: 1000, minLumpsum: 5000, fundManager: "Gaurav Misra" },
  { schemeCode: "118989", name: "SBI Small Cap Fund - Direct Growth",            amc: "SBI MF",         category: "Equity", subCategory: "Small Cap", riskLevel: "Very High", expenseRatio: 0.7,  aum: 25800, minSip: 500,  minLumpsum: 5000, fundManager: "R. Srinivasan" },
  { schemeCode: "120586", name: "Parag Parikh Flexi Cap Fund - Direct Growth",   amc: "PPFAS MF",       category: "Equity", subCategory: "Flexi Cap", riskLevel: "Very High", expenseRatio: 0.7,  aum: 65000, minSip: 1000, minLumpsum: 1000, fundManager: "Rajeev Thakkar" },
  { schemeCode: "119598", name: "Mirae Asset Tax Saver Fund - Direct Growth",    amc: "Mirae Asset MF", category: "ELSS",   subCategory: "ELSS",      riskLevel: "Very High", expenseRatio: 0.6,  aum: 18900, minSip: 500,  minLumpsum: 500,  fundManager: "Neelesh Surana" },
  { schemeCode: "120716", name: "UTI Nifty 50 Index Fund - Direct Growth",       amc: "UTI MF",         category: "Index",  subCategory: "Large Cap", riskLevel: "Very High", expenseRatio: 0.2,  aum: 14500, minSip: 500,  minLumpsum: 5000, fundManager: "Sharwan Kumar Goyal" },
  { schemeCode: "147949", name: "ICICI Prudential Nifty Next 50 Index - Direct", amc: "ICICI Pru MF",   category: "Index",  subCategory: "Mid Cap",   riskLevel: "Very High", expenseRatio: 0.3,  aum:  3500, minSip: 500,  minLumpsum: 5000, fundManager: "Kayzad Eghlim" },
  { schemeCode: "118473", name: "HDFC Balanced Advantage Fund - Direct Growth",  amc: "HDFC MF",        category: "Hybrid", subCategory: "Balanced",  riskLevel: "High",      expenseRatio: 0.85, aum: 70000, minSip: 500,  minLumpsum: 5000, fundManager: "Anil Bamboli" },
  { schemeCode: "118835", name: "Kotak Equity Hybrid Fund - Direct Growth",      amc: "Kotak MF",       category: "Hybrid", subCategory: "Aggressive",riskLevel: "High",      expenseRatio: 0.7,  aum:  4200, minSip: 1000, minLumpsum: 5000, fundManager: "Pankaj Tibrewal" },
  { schemeCode: "120669", name: "Axis Liquid Fund - Direct Growth",              amc: "Axis MF",        category: "Debt",   subCategory: "Liquid",    riskLevel: "Low",       expenseRatio: 0.15, aum: 30100, minSip: 1000, minLumpsum: 500,  fundManager: "Devang Shah" },
  { schemeCode: "118778", name: "Nippon India Small Cap Fund - Direct Growth",   amc: "Nippon India MF",category: "Equity", subCategory: "Small Cap", riskLevel: "Very High", expenseRatio: 0.7,  aum: 41000, minSip: 100,  minLumpsum: 5000, fundManager: "Samir Rachh" }
];

async function main() {
  console.log("Seeding stocks…");
  for (const s of STOCKS) {
    await prisma.stock.upsert({
      where: { symbol: s.symbol },
      update: { ...s, exchange: "NSE" },
      create: { ...s, exchange: "NSE" }
    });
  }
  console.log(`  ✓ ${STOCKS.length} stocks`);

  console.log("Seeding mutual funds…");
  for (const f of FUNDS) {
    await prisma.mutualFund.upsert({ where: { schemeCode: f.schemeCode }, update: f, create: f });
  }
  console.log(`  ✓ ${FUNDS.length} funds`);

  console.log("Seeding demo user…");
  const passwordHash = await bcrypt.hash("Demo@1234", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@tracker.in" },
    update: {},
    create: { fullName: "Demo Investor", email: "demo@tracker.in", phone: "9999999999", passwordHash, emailVerified: true }
  });

  // default watchlist + sample items
  const wl = await prisma.watchList.upsert({
    where: { userId_name: { userId: user.id, name: "My Watchlist" } },
    update: {},
    create: { userId: user.id, name: "My Watchlist" }
  });

  const watch = await prisma.stock.findMany({ where: { symbol: { in: ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ITC"] } } });
  for (let i = 0; i < watch.length; i++) {
    await prisma.watchListItem.upsert({
      where: { id: `seed-${user.id}-${watch[i].id}` },
      update: {},
      create: { id: `seed-${user.id}-${watch[i].id}`, watchListId: wl.id, stockId: watch[i].id, position: i }
    });
  }

  // sample transactions
  const reliance = watch.find((w) => w.symbol === "RELIANCE");
  const tcs = watch.find((w) => w.symbol === "TCS");
  if (reliance && tcs) {
    await prisma.portfolioTransaction.deleteMany({ where: { userId: user.id } });
    await prisma.portfolioTransaction.create({
      data: { userId: user.id, stockId: reliance.id, type: "BUY", date: new Date("2024-08-01"), quantity: 10, price: 2700, brokerage: 30 }
    });
    await prisma.portfolioTransaction.create({
      data: { userId: user.id, stockId: tcs.id, type: "BUY", date: new Date("2024-09-15"), quantity: 5, price: 4150, brokerage: 25 }
    });
  }

  console.log("  ✓ demo@tracker.in / Demo@1234");
  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
