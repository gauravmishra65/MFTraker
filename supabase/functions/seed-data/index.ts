import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── NSE Nifty 500 + Popular BSE stocks ────────────────────────────────────
// Format: [symbol, yahoo_symbol, name, sector, cap_category, isin, exchange]
const STOCKS_RAW: [string, string, string, string, string, string, string][] = [
  // NIFTY 50 - Large Cap
  ["RELIANCE",    "RELIANCE.NS",    "Reliance Industries Ltd",             "Energy",         "LARGE", "INE002A01018", "NSE"],
  ["TCS",         "TCS.NS",         "Tata Consultancy Services Ltd",       "IT",             "LARGE", "INE467B01029", "NSE"],
  ["HDFCBANK",    "HDFCBANK.NS",    "HDFC Bank Ltd",                       "Financials",     "LARGE", "INE040A01034", "NSE"],
  ["INFY",        "INFY.NS",        "Infosys Ltd",                         "IT",             "LARGE", "INE009A01021", "NSE"],
  ["ICICIBANK",   "ICICIBANK.NS",   "ICICI Bank Ltd",                      "Financials",     "LARGE", "INE090A01021", "NSE"],
  ["HINDUNILVR",  "HINDUNILVR.NS",  "Hindustan Unilever Ltd",              "FMCG",           "LARGE", "INE030A01027", "NSE"],
  ["BHARTIARTL",  "BHARTIARTL.NS",  "Bharti Airtel Ltd",                   "Telecom",        "LARGE", "INE397D01024", "NSE"],
  ["ITC",         "ITC.NS",         "ITC Ltd",                             "FMCG",           "LARGE", "INE154A01025", "NSE"],
  ["SBIN",        "SBIN.NS",        "State Bank of India",                 "Financials",     "LARGE", "INE062A01020", "NSE"],
  ["LT",          "LT.NS",          "Larsen & Toubro Ltd",                 "Construction",   "LARGE", "INE018A01030", "NSE"],
  ["KOTAKBANK",   "KOTAKBANK.NS",   "Kotak Mahindra Bank Ltd",             "Financials",     "LARGE", "INE237A01028", "NSE"],
  ["AXISBANK",    "AXISBANK.NS",    "Axis Bank Ltd",                       "Financials",     "LARGE", "INE238A01034", "NSE"],
  ["MARUTI",      "MARUTI.NS",      "Maruti Suzuki India Ltd",             "Auto",           "LARGE", "INE585B01010", "NSE"],
  ["TATAMOTORS",  "TATAMOTORS.NS",  "Tata Motors Ltd",                     "Auto",           "LARGE", "INE155A01022", "NSE"],
  ["WIPRO",       "WIPRO.NS",       "Wipro Ltd",                           "IT",             "LARGE", "INE075A01022", "NSE"],
  ["ASIANPAINT",  "ASIANPAINT.NS",  "Asian Paints Ltd",                    "Consumer",       "LARGE", "INE021A01026", "NSE"],
  ["SUNPHARMA",   "SUNPHARMA.NS",   "Sun Pharmaceutical Industries Ltd",   "Pharma",         "LARGE", "INE044A01036", "NSE"],
  ["TITAN",       "TITAN.NS",       "Titan Company Ltd",                   "Consumer",       "LARGE", "INE280A01028", "NSE"],
  ["BAJFINANCE",  "BAJFINANCE.NS",  "Bajaj Finance Ltd",                   "Financials",     "LARGE", "INE296A01024", "NSE"],
  ["ADANIENT",    "ADANIENT.NS",    "Adani Enterprises Ltd",               "Diversified",    "LARGE", "INE423A01024", "NSE"],
  ["NESTLEIND",   "NESTLEIND.NS",   "Nestle India Ltd",                    "FMCG",           "LARGE", "INE239A01016", "NSE"],
  ["ULTRACEMCO",  "ULTRACEMCO.NS",  "UltraTech Cement Ltd",                "Cement",         "LARGE", "INE481G01011", "NSE"],
  ["HCLTECH",     "HCLTECH.NS",     "HCL Technologies Ltd",                "IT",             "LARGE", "INE860A01027", "NSE"],
  ["ONGC",        "ONGC.NS",        "Oil and Natural Gas Corporation Ltd", "Energy",         "LARGE", "INE213A01029", "NSE"],
  ["NTPC",        "NTPC.NS",        "NTPC Ltd",                            "Power",          "LARGE", "INE733E01010", "NSE"],
  ["POWERGRID",   "POWERGRID.NS",   "Power Grid Corporation of India Ltd", "Power",          "LARGE", "INE752E01010", "NSE"],
  ["BAJAJFINSV",  "BAJAJFINSV.NS",  "Bajaj Finserv Ltd",                   "Financials",     "LARGE", "INE918I01026", "NSE"],
  ["TATASTEEL",   "TATASTEEL.NS",   "Tata Steel Ltd",                      "Metals",         "LARGE", "INE081A01020", "NSE"],
  ["JSWSTEEL",    "JSWSTEEL.NS",    "JSW Steel Ltd",                       "Metals",         "LARGE", "INE019A01038", "NSE"],
  ["HINDALCO",    "HINDALCO.NS",    "Hindalco Industries Ltd",             "Metals",         "LARGE", "INE038A01020", "NSE"],
  ["TECHM",       "TECHM.NS",       "Tech Mahindra Ltd",                   "IT",             "LARGE", "INE669C01036", "NSE"],
  ["DRREDDY",     "DRREDDY.NS",     "Dr. Reddy's Laboratories Ltd",        "Pharma",         "LARGE", "INE089A01023", "NSE"],
  ["CIPLA",       "CIPLA.NS",       "Cipla Ltd",                           "Pharma",         "LARGE", "INE059A01026", "NSE"],
  ["DIVISLAB",    "DIVISLAB.NS",    "Divi's Laboratories Ltd",             "Pharma",         "LARGE", "INE361B01024", "NSE"],
  ["BRITANNIA",   "BRITANNIA.NS",   "Britannia Industries Ltd",            "FMCG",           "LARGE", "INE216A01030", "NSE"],
  ["GRASIM",      "GRASIM.NS",      "Grasim Industries Ltd",               "Cement",         "LARGE", "INE047A01021", "NSE"],
  ["COALINDIA",   "COALINDIA.NS",   "Coal India Ltd",                      "Mining",         "LARGE", "INE522F01014", "NSE"],
  ["EICHERMOT",   "EICHERMOT.NS",   "Eicher Motors Ltd",                   "Auto",           "LARGE", "INE066A01021", "NSE"],
  ["HEROMOTOCO",  "HEROMOTOCO.NS",  "Hero MotoCorp Ltd",                   "Auto",           "LARGE", "INE158A01026", "NSE"],
  ["SHREECEM",    "SHREECEM.NS",    "Shree Cement Ltd",                    "Cement",         "LARGE", "INE070A01015", "NSE"],
  ["INDUSINDBK",  "INDUSINDBK.NS",  "IndusInd Bank Ltd",                   "Financials",     "LARGE", "INE095A01012", "NSE"],
  ["BAJAJ-AUTO",  "BAJAJ-AUTO.NS",  "Bajaj Auto Ltd",                      "Auto",           "LARGE", "INE917I01010", "NSE"],
  ["APOLLOHOSP",  "APOLLOHOSP.NS",  "Apollo Hospitals Enterprise Ltd",     "Healthcare",     "LARGE", "INE437A01024", "NSE"],
  ["ADANIPORTS",  "ADANIPORTS.NS",  "Adani Ports and SEZ Ltd",             "Logistics",      "LARGE", "INE742F01042", "NSE"],
  ["BPCL",        "BPCL.NS",        "Bharat Petroleum Corporation Ltd",    "Energy",         "LARGE", "INE029A01011", "NSE"],
  ["TATACONSUM",  "TATACONSUM.NS",  "Tata Consumer Products Ltd",          "FMCG",           "LARGE", "INE192A01025", "NSE"],
  // NIFTY Next 50 - Large Cap continued
  ["HDFCLIFE",    "HDFCLIFE.NS",    "HDFC Life Insurance Company Ltd",     "Insurance",      "LARGE", "INE795G01014", "NSE"],
  ["SBILIFE",     "SBILIFE.NS",     "SBI Life Insurance Company Ltd",      "Insurance",      "LARGE", "INE123W01016", "NSE"],
  ["ICICIPRULI",  "ICICIPRULI.NS",  "ICICI Prudential Life Insurance Co",  "Insurance",      "LARGE", "INE726G01019", "NSE"],
  ["ICICIGI",     "ICICIGI.NS",     "ICICI Lombard General Insurance Co",  "Insurance",      "LARGE", "INE765G01017", "NSE"],
  ["PIDILITIND",  "PIDILITIND.NS",  "Pidilite Industries Ltd",             "Chemicals",      "LARGE", "INE318A01026", "NSE"],
  ["SIEMENS",     "SIEMENS.NS",     "Siemens Ltd",                         "Industrials",    "LARGE", "INE003A01024", "NSE"],
  ["ABB",         "ABB.NS",         "ABB India Ltd",                       "Industrials",    "LARGE", "INE117A01022", "NSE"],
  ["BOSCHLTD",    "BOSCHLTD.NS",    "Bosch Ltd",                           "Auto",           "LARGE", "INE323A01026", "NSE"],
  ["MCDOWELL-N",  "MCDOWELL-N.NS",  "United Spirits Ltd",                  "Consumer",       "LARGE", "INE854D01024", "NSE"],
  ["VEDL",        "VEDL.NS",        "Vedanta Ltd",                         "Metals",         "LARGE", "INE205A01025", "NSE"],
  ["ZOMATO",      "ZOMATO.NS",      "Zomato Ltd",                          "Consumer Tech",  "LARGE", "INE758T01015", "NSE"],
  ["PAYTM",       "PAYTM.NS",       "One97 Communications Ltd (Paytm)",    "Fintech",        "MID",   "INE982J01020", "NSE"],
  ["NYKAA",       "NYKAA.NS",       "FSN E-Commerce Ventures Ltd (Nykaa)", "Consumer Tech",  "MID",   "INE388Y01029", "NSE"],
  ["POLICYBZR",   "POLICYBZR.NS",   "PB Fintech Ltd (Policybazaar)",       "Fintech",        "MID",   "INE417T01026", "NSE"],
  ["IRCTC",       "IRCTC.NS",       "Indian Railway Catering and Tourism", "Consumer",       "LARGE", "INE335Y01020", "NSE"],
  ["DMART",       "DMART.NS",       "Avenue Supermarts Ltd (DMart)",       "Retail",         "LARGE", "INE192R01011", "NSE"],
  ["MUTHOOTFIN",  "MUTHOOTFIN.NS",  "Muthoot Finance Ltd",                 "Financials",     "LARGE", "INE414G01012", "NSE"],
  ["CHOLAFIN",    "CHOLAFIN.NS",    "Cholamandalam Investment Finance Co", "Financials",     "LARGE", "INE121A01024", "NSE"],
  ["MOTHERSON",   "MOTHERSON.NS",   "Samvardhana Motherson International", "Auto",           "LARGE", "INE775A01035", "NSE"],
  ["HAVELLS",     "HAVELLS.NS",     "Havells India Ltd",                   "Industrials",    "LARGE", "INE176B01034", "NSE"],
  ["BERGEPAINT",  "BERGEPAINT.NS",  "Berger Paints India Ltd",             "Consumer",       "LARGE", "INE463A01038", "NSE"],
  ["TORNTPHARM",  "TORNTPHARM.NS",  "Torrent Pharmaceuticals Ltd",         "Pharma",         "LARGE", "INE685A01028", "NSE"],
  ["LUPIN",       "LUPIN.NS",       "Lupin Ltd",                           "Pharma",         "LARGE", "INE326A01037", "NSE"],
  ["BIOCON",      "BIOCON.NS",      "Biocon Ltd",                          "Pharma",         "LARGE", "INE376G01013", "NSE"],
  ["AUROPHARMA",  "AUROPHARMA.NS",  "Aurobindo Pharma Ltd",                "Pharma",         "LARGE", "INE406A01037", "NSE"],
  ["ALKEM",       "ALKEM.NS",       "Alkem Laboratories Ltd",              "Pharma",         "MID",   "INE540L01014", "NSE"],
  ["MPHASIS",     "MPHASIS.NS",     "MphasiS Ltd",                         "IT",             "MID",   "INE356A01018", "NSE"],
  ["LTIM",        "LTIM.NS",        "LTIMindtree Ltd",                     "IT",             "LARGE", "INE214T01019", "NSE"],
  ["PERSISTENT",  "PERSISTENT.NS",  "Persistent Systems Ltd",              "IT",             "MID",   "INE262H01021", "NSE"],
  ["COFORGE",     "COFORGE.NS",     "Coforge Ltd",                         "IT",             "MID",   "INE591G01017", "NSE"],
  ["OFSS",        "OFSS.NS",        "Oracle Financial Services Software",  "IT",             "LARGE", "INE881D01027", "NSE"],
  ["KPITTECH",    "KPITTECH.NS",    "KPIT Technologies Ltd",               "IT",             "MID",   "INE138Y01010", "NSE"],
  ["TANLA",       "TANLA.NS",       "Tanla Platforms Ltd",                 "IT",             "MID",   "INE483C01032", "NSE"],
  ["BANKBARODA",  "BANKBARODA.NS",  "Bank of Baroda",                      "Financials",     "LARGE", "INE028A01039", "NSE"],
  ["PNB",         "PNB.NS",         "Punjab National Bank",                "Financials",     "LARGE", "INE160A01022", "NSE"],
  ["CANBK",       "CANBK.NS",       "Canara Bank",                         "Financials",     "LARGE", "INE476A01014", "NSE"],
  ["UNIONBANK",   "UNIONBANK.NS",   "Union Bank of India",                 "Financials",     "LARGE", "INE692A01016", "NSE"],
  ["FEDERALBNK",  "FEDERALBNK.NS",  "The Federal Bank Ltd",                "Financials",     "MID",   "INE171A01029", "NSE"],
  ["IDFCFIRSTB",  "IDFCFIRSTB.NS",  "IDFC First Bank Ltd",                 "Financials",     "MID",   "INE092T01019", "NSE"],
  ["RBLBANK",     "RBLBANK.NS",     "RBL Bank Ltd",                        "Financials",     "MID",   "INE976G01028", "NSE"],
  ["YESBANK",     "YESBANK.NS",     "Yes Bank Ltd",                        "Financials",     "MID",   "INE528G01035", "NSE"],
  ["BANDHANBNK",  "BANDHANBNK.NS",  "Bandhan Bank Ltd",                    "Financials",     "MID",   "INE545U01014", "NSE"],
  ["KAJARIACER",  "KAJARIACER.NS",  "Kajaria Ceramics Ltd",                "Consumer",       "MID",   "INE217B01036", "NSE"],
  ["CUMMINSIND",  "CUMMINSIND.NS",  "Cummins India Ltd",                   "Industrials",    "MID",   "INE298A01020", "NSE"],
  ["VOLTAS",      "VOLTAS.NS",      "Voltas Ltd",                          "Consumer",       "MID",   "INE226A01021", "NSE"],
  ["CROMPTON",    "CROMPTON.NS",    "Crompton Greaves Consumer Electricals","Industrials",   "MID",   "INE067A01029", "NSE"],
  ["BLUESTARCO",  "BLUESTARCO.NS",  "Blue Star Ltd",                       "Industrials",    "MID",   "INE386A01023", "NSE"],
  ["GODREJCP",    "GODREJCP.NS",    "Godrej Consumer Products Ltd",        "FMCG",           "LARGE", "INE102D01028", "NSE"],
  ["GODREJPROP",  "GODREJPROP.NS",  "Godrej Properties Ltd",               "Realty",         "LARGE", "INE484J01027", "NSE"],
  ["OBEROIRLTY",  "OBEROIRLTY.NS",  "Oberoi Realty Ltd",                   "Realty",         "MID",   "INE093I01010", "NSE"],
  ["DLF",         "DLF.NS",         "DLF Ltd",                             "Realty",         "LARGE", "INE271C01023", "NSE"],
  ["PRESTIGE",    "PRESTIGE.NS",    "Prestige Estates Projects Ltd",       "Realty",         "MID",   "INE811K01011", "NSE"],
  ["SOBHA",       "SOBHA.NS",       "Sobha Ltd",                           "Realty",         "MID",   "INE671H01015", "NSE"],
  ["PHOENIXLTD",  "PHOENIXLTD.NS",  "The Phoenix Mills Ltd",               "Realty",         "MID",   "INE211B01039", "NSE"],
  ["MARICO",      "MARICO.NS",      "Marico Ltd",                          "FMCG",           "LARGE", "INE196A01026", "NSE"],
  ["COLPAL",      "COLPAL.NS",      "Colgate-Palmolive (India) Ltd",       "FMCG",           "LARGE", "INE259A01022", "NSE"],
  ["DABUR",       "DABUR.NS",       "Dabur India Ltd",                     "FMCG",           "LARGE", "INE016A01026", "NSE"],
  ["EMAMILTD",    "EMAMILTD.NS",    "Emami Ltd",                           "FMCG",           "MID",   "INE548C01032", "NSE"],
  ["GODREJIND",   "GODREJIND.NS",   "Godrej Industries Ltd",               "Diversified",    "MID",   "INE233A01035", "NSE"],
  ["TATAPOWER",   "TATAPOWER.NS",   "Tata Power Company Ltd",              "Power",          "LARGE", "INE245A01021", "NSE"],
  ["ADANIGREEN",  "ADANIGREEN.NS",  "Adani Green Energy Ltd",              "Power",          "LARGE", "INE364U01010", "NSE"],
  ["ADANITRANS",  "ADANITRANS.NS",  "Adani Transmission Ltd",              "Power",          "LARGE", "INE931S01010", "NSE"],
  ["ADANIPOWER",  "ADANIPOWER.NS",  "Adani Power Ltd",                     "Power",          "LARGE", "INE814H01011", "NSE"],
  ["TORNTPOWER",  "TORNTPOWER.NS",  "Torrent Power Ltd",                   "Power",          "MID",   "INE813H01021", "NSE"],
  ["CESC",        "CESC.NS",        "CESC Ltd",                            "Power",          "MID",   "INE486A01021", "NSE"],
  ["JSPL",        "JSPL.NS",        "Jindal Steel & Power Ltd",            "Metals",         "LARGE", "INE749A01030", "NSE"],
  ["SAIL",        "SAIL.NS",        "Steel Authority of India Ltd",        "Metals",         "LARGE", "INE114A01011", "NSE"],
  ["NMDC",        "NMDC.NS",        "NMDC Ltd",                            "Mining",         "LARGE", "INE584A01023", "NSE"],
  ["HINDCOPPER",  "HINDCOPPER.NS",  "Hindustan Copper Ltd",                "Metals",         "MID",   "INE531E01026", "NSE"],
  ["NATIONALUM",  "NATIONALUM.NS",  "National Aluminium Company Ltd",      "Metals",         "MID",   "INE139A01034", "NSE"],
  ["INDIGO",      "INDIGO.NS",      "InterGlobe Aviation Ltd (IndiGo)",    "Airlines",       "LARGE", "INE646L01027", "NSE"],
  ["SPICEJET",    "SPICEJET.NS",    "SpiceJet Ltd",                        "Airlines",       "SMALL", "INE285B01017", "NSE"],
  ["CONCOR",      "CONCOR.NS",      "Container Corporation of India Ltd",  "Logistics",      "LARGE", "INE111A01025", "NSE"],
  ["VRL",         "VRL.NS",         "VRL Logistics Ltd",                   "Logistics",      "MID",   "INE366I01010", "NSE"],
  ["BLUEDART",    "BLUEDART.NS",    "Blue Dart Express Ltd",               "Logistics",      "MID",   "INE233B01017", "NSE"],
  ["APOLLOTYRE",  "APOLLOTYRE.NS",  "Apollo Tyres Ltd",                    "Auto",           "MID",   "INE438A01022", "NSE"],
  ["MRF",         "MRF.NS",         "MRF Ltd",                             "Auto",           "LARGE", "INE883A01011", "NSE"],
  ["CEATLTD",     "CEATLTD.NS",     "CEAT Ltd",                            "Auto",           "MID",   "INE482A01020", "NSE"],
  ["BALKRISIND",  "BALKRISIND.NS",  "Balkrishna Industries Ltd",           "Auto",           "MID",   "INE787D01026", "NSE"],
  ["AMARAJABAT",  "AMARAJABAT.NS",  "Amara Raja Energy & Mobility Ltd",   "Auto",           "MID",   "INE885A01032", "NSE"],
  ["EXIDEIND",    "EXIDEIND.NS",    "Exide Industries Ltd",                "Auto",           "MID",   "INE302A01020", "NSE"],
  ["SUNDRMFAST",  "SUNDRMFAST.NS",  "Sundram Fasteners Ltd",               "Auto",           "MID",   "INE387A01021", "NSE"],
  ["SCHAEFFLER",  "SCHAEFFLER.NS",  "Schaeffler India Ltd",                "Auto",           "MID",   "INE513A01022", "NSE"],
  ["TVSMOTOR",    "TVSMOTOR.NS",    "TVS Motor Company Ltd",               "Auto",           "LARGE", "INE494B01023", "NSE"],
  ["MAHINDRA",    "M&M.NS",         "Mahindra & Mahindra Ltd",             "Auto",           "LARGE", "INE101A01026", "NSE"],
  ["ASHOKLEY",    "ASHOKLEY.NS",    "Ashok Leyland Ltd",                   "Auto",           "LARGE", "INE208A01029", "NSE"],
  ["ESCORTS",     "ESCORTS.NS",     "Escorts Kubota Ltd",                  "Auto",           "MID",   "INE042A01014", "NSE"],
  ["FORCEMOT",    "FORCEMOT.NS",    "Force Motors Ltd",                    "Auto",           "MID",   "INE386C01029", "NSE"],
  ["TATACHEM",    "TATACHEM.NS",    "Tata Chemicals Ltd",                  "Chemicals",      "MID",   "INE092A01019", "NSE"],
  ["DEEPAKNTR",   "DEEPAKNTR.NS",   "Deepak Nitrite Ltd",                  "Chemicals",      "MID",   "INE288B01029", "NSE"],
  ["CLEAN",       "CLEAN.NS",       "Clean Science and Technology Ltd",    "Chemicals",      "MID",   "INE448A01028", "NSE"],
  ["FINEORG",     "FINEORG.NS",     "Fine Organic Industries Ltd",         "Chemicals",      "MID",   "INE686Y01026", "NSE"],
  ["NAVINFLUOR",  "NAVINFLUOR.NS",  "Navin Fluorine International Ltd",    "Chemicals",      "MID",   "INE048G01026", "NSE"],
  ["AARTIIND",    "AARTIIND.NS",    "Aarti Industries Ltd",                "Chemicals",      "MID",   "INE769A01020", "NSE"],
  ["VINDHYATEL",  "VINDHYATEL.NS",  "Vindhya Telelinks Ltd",               "Telecom",        "MID",   "INE835A01011", "NSE"],
  ["TATACOMM",    "TATACOMM.NS",    "Tata Communications Ltd",             "Telecom",        "MID",   "INE151A01013", "NSE"],
  ["ROUTE",       "ROUTE.NS",       "Route Mobile Ltd",                    "Telecom",        "MID",   "INE0AC201019", "NSE"],
  ["INDUSTOWER",  "INDUSTOWER.NS",  "Indus Towers Ltd",                    "Telecom",        "LARGE", "INE121J01017", "NSE"],
  ["HFCL",        "HFCL.NS",        "HFCL Ltd",                            "Telecom",        "MID",   "INE548A01028", "NSE"],
  ["DIXON",       "DIXON.NS",       "Dixon Technologies (India) Ltd",      "Industrials",    "MID",   "INE935N01012", "NSE"],
  ["KAYNES",      "KAYNES.NS",      "Kaynes Technology India Ltd",         "Industrials",    "MID",   "INE0MBP01013", "NSE"],
  ["BHEL",        "BHEL.NS",        "Bharat Heavy Electricals Ltd",        "Industrials",    "LARGE", "INE257A01026", "NSE"],
  ["BEL",         "BEL.NS",         "Bharat Electronics Ltd",              "Defence",        "LARGE", "INE263A01024", "NSE"],
  ["HAL",         "HAL.NS",         "Hindustan Aeronautics Ltd",           "Defence",        "LARGE", "INE066F01020", "NSE"],
  ["MFSL",        "MFSL.NS",        "Max Financial Services Ltd",          "Insurance",      "MID",   "INE180A01020", "NSE"],
  ["GICRE",       "GICRE.NS",       "General Insurance Corp. of India",    "Insurance",      "MID",   "INE481Y01014", "NSE"],
  ["NIACL",       "NIACL.NS",       "New India Assurance Co. Ltd",         "Insurance",      "MID",   "INE470Y01017", "NSE"],
  ["MANAPPURAM", "MANAPPURAM.NS",   "Manappuram Finance Ltd",              "Financials",     "MID",   "INE522D01027", "NSE"],
  ["LICHSGFIN",   "LICHSGFIN.NS",   "LIC Housing Finance Ltd",             "Financials",     "LARGE", "INE115A01026", "NSE"],
  ["RECLTD",      "RECLTD.NS",      "REC Ltd",                             "Financials",     "LARGE", "INE020B01018", "NSE"],
  ["PFC",         "PFC.NS",         "Power Finance Corporation Ltd",       "Financials",     "LARGE", "INE134E01011", "NSE"],
  ["IRFC",        "IRFC.NS",        "Indian Railway Finance Corporation",  "Financials",     "LARGE", "INE053F01010", "NSE"],
  ["CDSL",        "CDSL.NS",        "Central Depository Services (India)", "Financials",     "MID",   "INE736A01011", "NSE"],
  ["BSE",         "BSE.NS",         "BSE Ltd",                             "Financials",     "MID",   "INE118H01025", "NSE"],
  ["MCX",         "MCX.NS",         "Multi Commodity Exchange of India",   "Financials",     "MID",   "INE745G01035", "NSE"],
  ["ANGELONE",    "ANGELONE.NS",    "Angel One Ltd",                       "Financials",     "MID",   "INE732I01013", "NSE"],
  ["360ONE",      "360ONE.NS",      "360 One WAM Ltd",                     "Financials",     "MID",   "INE248U01004", "NSE"],
  ["NUVAMA",      "NUVAMA.NS",      "Nuvama Wealth Management Ltd",        "Financials",     "MID",   "INE160T01028", "NSE"],
  ["MOTHERBEAR",  "MOTHERBEAR.NS",  "Motherboard FIEM Industries Ltd",     "Auto",           "SMALL", "INE490G01020", "NSE"],
  ["ZYDUSLIFE",   "ZYDUSLIFE.NS",   "Zydus Lifesciences Ltd",              "Pharma",         "LARGE", "INE010B01027", "NSE"],
  ["GLAND",       "GLAND.NS",       "Gland Pharma Ltd",                    "Pharma",         "MID",   "INE068D01021", "NSE"],
  ["GRANULES",    "GRANULES.NS",    "Granules India Ltd",                  "Pharma",         "MID",   "INE101D01020", "NSE"],
  ["IPCALAB",     "IPCALAB.NS",     "IPCA Laboratories Ltd",               "Pharma",         "MID",   "INE571A01020", "NSE"],
  ["JBCHEPHARM",  "JBCHEPHARM.NS",  "J.B. Chemicals & Pharmaceuticals",   "Pharma",         "MID",   "INE572A01028", "NSE"],
  ["NATCOPHARM",  "NATCOPHARM.NS",  "Natco Pharma Ltd",                    "Pharma",         "MID",   "INE987B01026", "NSE"],
  ["SYNGENE",     "SYNGENE.NS",     "Syngene International Ltd",           "Pharma",         "MID",   "INE398R01022", "NSE"],
  ["METROPOLIS",  "METROPOLIS.NS",  "Metropolis Healthcare Ltd",           "Healthcare",     "MID",   "INE112L01020", "NSE"],
  ["LALPATHLAB",  "LALPATHLAB.NS",  "Dr. Lal PathLabs Ltd",                "Healthcare",     "MID",   "INE600L01024", "NSE"],
  ["THYROCARE",   "THYROCARE.NS",   "Thyrocare Technologies Ltd",          "Healthcare",     "MID",   "INE617H01012", "NSE"],
  ["NH",          "NH.NS",          "Narayana Hrudayalaya Ltd",            "Healthcare",     "MID",   "INE410P01011", "NSE"],
  ["FORTIS",      "FORTIS.NS",      "Fortis Healthcare Ltd",               "Healthcare",     "MID",   "INE061F01013", "NSE"],
  ["MAXHEALTH",   "MAXHEALTH.NS",   "Max Healthcare Institute Ltd",        "Healthcare",     "LARGE", "INE027H01010", "NSE"],
  ["INDIAMART",   "INDIAMART.NS",   "Indiamart Intermesh Ltd",             "Consumer Tech",  "MID",   "INE933S01016", "NSE"],
  ["JUSTDIAL",    "JUSTDIAL.NS",    "Just Dial Ltd",                       "Consumer Tech",  "MID",   "INE599M01018", "NSE"],
  ["CARTRADE",    "CARTRADE.NS",    "CarTrade Tech Ltd",                   "Consumer Tech",  "MID",   "INE0ABF01017", "NSE"],
  ["EASEMYTRIP",  "EASEMYTRIP.NS",  "Easy Trip Planners Ltd (EaseMyTrip)","Consumer Tech",  "MID",   "INE0IN01019",  "NSE"],
  ["SWIGGY",      "SWIGGY.NS",      "Bundl Technologies Ltd (Swiggy)",    "Consumer Tech",  "LARGE", "INE0LTT01016", "NSE"],
  ["TATAINVEST",  "TATAINVEST.NS",  "Tata Investment Corporation Ltd",     "Financials",     "MID",   "INE672A01018", "NSE"],
  ["ASTRAL",      "ASTRAL.NS",      "Astral Ltd",                          "Industrials",    "LARGE", "INE006I01046", "NSE"],
  ["SUPREMEIND",  "SUPREMEIND.NS",  "Supreme Industries Ltd",              "Industrials",    "MID",   "INE195A01028", "NSE"],
  ["APLAPOLLO",   "APLAPOLLO.NS",   "APL Apollo Tubes Ltd",                "Metals",         "MID",   "INE702C01027", "NSE"],
  ["RATNAMANI",   "RATNAMANI.NS",   "Ratnamani Metals & Tubes Ltd",        "Metals",         "MID",   "INE703B01027", "NSE"],
  ["GRINDWELL",   "GRINDWELL.NS",   "Grindwell Norton Ltd",                "Industrials",    "MID",   "INE536A01023", "NSE"],
  ["TIMKEN",      "TIMKEN.NS",      "Timken India Ltd",                    "Industrials",    "MID",   "INE325A01013", "NSE"],
  ["SKFINDIA",    "SKFINDIA.NS",    "SKF India Ltd",                       "Industrials",    "MID",   "INE640A01023", "NSE"],
  ["THERMAX",     "THERMAX.NS",     "Thermax Ltd",                         "Industrials",    "MID",   "INE152A01029", "NSE"],
  ["KEC",         "KEC.NS",         "KEC International Ltd",               "Industrials",    "MID",   "INE389H01022", "NSE"],
  ["KALPATPOWR",  "KALPATPOWR.NS",  "Kalpataru Projects International",    "Industrials",    "MID",   "INE220B01022", "NSE"],
  ["WABAG",       "WABAG.NS",       "VA Tech Wabag Ltd",                   "Industrials",    "MID",   "INE142J01025", "NSE"],
  ["PRAJIND",     "PRAJIND.NS",     "Praj Industries Ltd",                 "Industrials",    "MID",   "INE074B01023", "NSE"],
  ["VBL",         "VBL.NS",         "Varun Beverages Ltd",                 "FMCG",           "LARGE", "INE200M01013", "NSE"],
  ["RADICO",      "RADICO.NS",      "Radico Khaitan Ltd",                  "Consumer",       "MID",   "INE944F01028", "NSE"],
  ["UNITDSPR",    "UNITDSPR.NS",    "United Breweries Ltd",                "Consumer",       "MID",   "INE686F01025", "NSE"],
  ["PATANJALI",   "PATANJALI.NS",   "Patanjali Foods Ltd",                 "FMCG",           "MID",   "INE619A01035", "NSE"],
  ["TATAELXSI",   "TATAELXSI.NS",   "Tata Elxsi Ltd",                      "IT",             "MID",   "INE670A01012", "NSE"],
  ["HEXAWARE",    "HEXAWARE.NS",    "Hexaware Technologies Ltd",           "IT",             "LARGE", "INE366A01041", "NSE"],
  ["NIIT",        "NIIT.NS",        "NIIT Ltd",                            "IT",             "SMALL", "INE236A01020", "NSE"],
  ["MASTEK",      "MASTEK.NS",      "Mastek Ltd",                          "IT",             "MID",   "INE759A01021", "NSE"],
  ["ZENSAR",      "ZENSAR.NS",      "Zensar Technologies Ltd",             "IT",             "MID",   "INE520A01027", "NSE"],
  ["CYIENT",      "CYIENT.NS",      "Cyient Ltd",                          "IT",             "MID",   "INE136B01020", "NSE"],
  ["BIRLASOFT",   "BIRLASOFT.NS",   "Birlasoft Ltd",                       "IT",             "MID",   "INE836A01035", "NSE"],
  ["RATEGAIN",    "RATEGAIN.NS",    "RateGain Travel Technologies Ltd",    "IT",             "MID",   "INE0IN501013", "NSE"],
  // BSE-listed (adding .BO suffix for Yahoo)
  ["BAJAJ_ELEC",  "BAJAJELEC.BO",   "Bajaj Electricals Ltd",               "Industrials",    "MID",   "INE193E01017", "BSE"],
  ["SYMPHONY",    "SYMPHONY.BO",    "Symphony Ltd",                        "Consumer",       "MID",   "INE225I01026", "BSE"],
  ["WOCKPHARMA",  "WOCKPHARMA.BO",  "Wockhardt Ltd",                       "Pharma",         "MID",   "INE049B01025", "BSE"],
  ["PFIZER",      "PFIZER.BO",      "Pfizer Ltd",                          "Pharma",         "MID",   "INE182A01018", "BSE"],
  ["GILLETTE",    "GILLETTE.BO",    "Gillette India Ltd",                  "FMCG",           "MID",   "INE322A01010", "BSE"],
];

// ─── Build stock records from raw data ─────────────────────────────────────
const STOCKS = STOCKS_RAW.map(([symbol, yahoo_symbol, name, sector, cap_category, isin, exchange]) => ({
  symbol, yahoo_symbol, name, sector, cap_category, isin, exchange,
}));

// ─── Fetch all mutual funds from AMFI India ─────────────────────────────────
async function fetchAMFIFunds(): Promise<any[]> {
  const resp = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`AMFI fetch failed: ${resp.status}`);
  const text = await resp.text();

  const funds: any[] = [];
  let currentAmc = "";
  let currentCategory = "";

  const CATEGORY_KEYWORDS: Record<string, { category: string; sub_category: string; risk_level: string }> = {
    "large cap": { category: "Equity", sub_category: "Large Cap", risk_level: "Very High" },
    "mid cap": { category: "Equity", sub_category: "Mid Cap", risk_level: "Very High" },
    "small cap": { category: "Equity", sub_category: "Small Cap", risk_level: "Very High" },
    "multi cap": { category: "Equity", sub_category: "Multi Cap", risk_level: "Very High" },
    "flexi cap": { category: "Equity", sub_category: "Flexi Cap", risk_level: "Very High" },
    "focused fund": { category: "Equity", sub_category: "Focused", risk_level: "Very High" },
    "elss": { category: "ELSS", sub_category: "ELSS", risk_level: "Very High" },
    "index fund": { category: "Index", sub_category: "Index", risk_level: "High" },
    "etf": { category: "ETF", sub_category: "ETF", risk_level: "High" },
    "liquid": { category: "Debt", sub_category: "Liquid", risk_level: "Low" },
    "overnight": { category: "Debt", sub_category: "Overnight", risk_level: "Low" },
    "ultra short": { category: "Debt", sub_category: "Ultra Short Duration", risk_level: "Low to Moderate" },
    "short duration": { category: "Debt", sub_category: "Short Duration", risk_level: "Low to Moderate" },
    "medium duration": { category: "Debt", sub_category: "Medium Duration", risk_level: "Moderate" },
    "long duration": { category: "Debt", sub_category: "Long Duration", risk_level: "Moderate to High" },
    "gilt": { category: "Debt", sub_category: "Gilt", risk_level: "Moderate" },
    "corporate bond": { category: "Debt", sub_category: "Corporate Bond", risk_level: "Moderate" },
    "credit risk": { category: "Debt", sub_category: "Credit Risk", risk_level: "High" },
    "balanced advantage": { category: "Hybrid", sub_category: "Balanced Advantage", risk_level: "High" },
    "aggressive hybrid": { category: "Hybrid", sub_category: "Aggressive Hybrid", risk_level: "Very High" },
    "conservative hybrid": { category: "Hybrid", sub_category: "Conservative Hybrid", risk_level: "Moderate" },
    "equity savings": { category: "Hybrid", sub_category: "Equity Savings", risk_level: "Moderate" },
    "arbitrage": { category: "Hybrid", sub_category: "Arbitrage", risk_level: "Low" },
    "fund of fund": { category: "FoF", sub_category: "Fund of Funds", risk_level: "High" },
    "sectoral": { category: "Sectoral/Thematic", sub_category: "Sectoral", risk_level: "Very High" },
    "thematic": { category: "Sectoral/Thematic", sub_category: "Thematic", risk_level: "Very High" },
    "dividend yield": { category: "Equity", sub_category: "Dividend Yield", risk_level: "High" },
    "value fund": { category: "Equity", sub_category: "Value", risk_level: "Very High" },
    "contra fund": { category: "Equity", sub_category: "Contra", risk_level: "Very High" },
  };

  function inferCategory(name: string): { category: string; sub_category: string; risk_level: string } {
    const lower = name.toLowerCase();
    for (const [kw, meta] of Object.entries(CATEGORY_KEYWORDS)) {
      if (lower.includes(kw)) return meta;
    }
    if (lower.includes("equity") || lower.includes("growth")) return { category: "Equity", sub_category: "General", risk_level: "Very High" };
    if (lower.includes("debt") || lower.includes("income") || lower.includes("bond")) return { category: "Debt", sub_category: "General", risk_level: "Moderate" };
    if (lower.includes("hybrid") || lower.includes("balanced")) return { category: "Hybrid", sub_category: "General", risk_level: "High" };
    return { category: "Equity", sub_category: "General", risk_level: "Very High" };
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Lines without semicolons are headers, AMC names, or category markers
    if (!trimmed.includes(";")) {
      if (trimmed.startsWith("Open Ended") || trimmed.startsWith("Close Ended") || trimmed.startsWith("Interval Fund")) {
        currentCategory = trimmed;
      } else if (trimmed.length > 3 && !/^scheme name$/i.test(trimmed)) {
        // Any non-data, non-category line is an AMC name
        currentAmc = trimmed.replace(/\s+/g, " ").trim();
      }
      continue;
    }

    const parts = trimmed.split(";");
    // AMFI format: SchemeCode;ISINDivPayout;ISINDivReinvestment;SchemeName;NAV;Date
    if (parts.length < 5) continue;
    const schemeCode = parts[0].trim();
    const schemeName = parts[3].trim();
    const navStr = parts[4].trim();
    const nav = parseFloat(navStr);

    // schemeCode must be a non-empty numeric string
    if (!schemeCode || !/^\d+$/.test(schemeCode) || !schemeName) continue;
    // Include Growth and Direct plans; skip Dividend/IDCW payout/reinvestment duplicates
    if (!/growth|direct/i.test(schemeName)) continue;
    if (/dividend|idcw|payout|reinvest/i.test(schemeName)) continue;

    const { category, sub_category, risk_level } = inferCategory(schemeName + " " + currentCategory);

    funds.push({
      scheme_code: schemeCode,
      name: schemeName.slice(0, 250),
      amc: currentAmc.slice(0, 100) || "Unknown AMC",
      category,
      sub_category,
      risk_level,
      fund_manager: null,
      expense_ratio: null,
      aum: null,
      min_sip: 500,
      min_lumpsum: 5000,
      benchmark: null,
      nav: isNaN(nav) ? null : nav,
    });
  }

  return funds;
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const sb = createClient(supabaseUrl, serviceKey);

    const mode = new URL(req.url).searchParams.get("mode") ?? "all";
    let stocksInserted = 0;
    let fundsInserted = 0;

    if (mode === "all" || mode === "stocks") {
      const BATCH = 50;
      const batches: (typeof STOCKS)[] = [];
      for (let i = 0; i < STOCKS.length; i += BATCH) batches.push(STOCKS.slice(i, i + BATCH));
      const results = await Promise.all(batches.map((b) => sb.from("stocks").upsert(b, { onConflict: "symbol" })));
      const firstErr = results.find((r) => r.error);
      if (firstErr?.error) return jsonRes({ error: `stocks: ${firstErr.error.message}` }, 500);
      stocksInserted = STOCKS.length;
    }

    if (mode === "all" || mode === "mf") {
      let funds: any[];
      try {
        funds = await fetchAMFIFunds();
      } catch (e: unknown) {
        return jsonRes({ error: `AMFI fetch: ${e instanceof Error ? e.message : String(e)}` }, 500);
      }

      const BATCH = 200;
      const mfBatches: (typeof funds)[] = [];
      for (let i = 0; i < funds.length; i += BATCH) mfBatches.push(funds.slice(i, i + BATCH));
      const mfResults = await Promise.all(
        mfBatches.map((b) => sb.from("mutual_funds").upsert(b, { onConflict: "scheme_code" }))
      );
      for (let i = 0; i < mfResults.length; i++) {
        const { error } = mfResults[i];
        if (error) console.error(`MF batch ${i * BATCH}: ${error.message}`);
        else fundsInserted += mfBatches[i].length;
      }
    }

    const [{ count: stockCount }, { count: fundCount }] = await Promise.all([
      sb.from("stocks").select("*", { count: "exact", head: true }),
      sb.from("mutual_funds").select("*", { count: "exact", head: true }),
    ]);

    return jsonRes({ ok: true, seeded: { stocks: stocksInserted, mutual_funds: fundsInserted }, totals: { stocks: stockCount, mutual_funds: fundCount } });
  } catch (e: unknown) {
    return jsonRes({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
