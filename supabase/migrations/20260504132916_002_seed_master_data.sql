/*
  # Seed master data

  Inserts 23 NSE large/mid/small cap stocks and 11 mutual fund schemes
  covering all major categories (Equity, ELSS, Index, Hybrid, Debt).
*/

-- ─── STOCKS ──────────────────────────────────────────────────────────────────
INSERT INTO public.stocks (symbol, yahoo_symbol, name, exchange, sector, industry, cap_category, face_value) VALUES
  ('RELIANCE',   'RELIANCE.NS',   'Reliance Industries Ltd',           'NSE', 'Energy',              'Oil & Gas Refining',        'LARGE', 10),
  ('TCS',        'TCS.NS',        'Tata Consultancy Services Ltd',     'NSE', 'Technology',          'IT Services',               'LARGE', 1),
  ('HDFCBANK',   'HDFCBANK.NS',   'HDFC Bank Ltd',                     'NSE', 'Financial Services',  'Private Sector Bank',       'LARGE', 1),
  ('INFY',       'INFY.NS',       'Infosys Ltd',                       'NSE', 'Technology',          'IT Services',               'LARGE', 5),
  ('ICICIBANK',  'ICICIBANK.NS',  'ICICI Bank Ltd',                    'NSE', 'Financial Services',  'Private Sector Bank',       'LARGE', 2),
  ('HINDUNILVR', 'HINDUNILVR.NS', 'Hindustan Unilever Ltd',            'NSE', 'FMCG',                'Personal Products',         'LARGE', 1),
  ('SBIN',       'SBIN.NS',       'State Bank of India',               'NSE', 'Financial Services',  'Public Sector Bank',        'LARGE', 1),
  ('BHARTIARTL', 'BHARTIARTL.NS', 'Bharti Airtel Ltd',                 'NSE', 'Communication',       'Telecom Services',          'LARGE', 5),
  ('KOTAKBANK',  'KOTAKBANK.NS',  'Kotak Mahindra Bank Ltd',           'NSE', 'Financial Services',  'Private Sector Bank',       'LARGE', 5),
  ('ITC',        'ITC.NS',        'ITC Ltd',                           'NSE', 'FMCG',                'Tobacco & FMCG',            'LARGE', 1),
  ('LT',         'LT.NS',         'Larsen & Toubro Ltd',               'NSE', 'Industrials',         'Construction & Engineering','LARGE', 2),
  ('AXISBANK',   'AXISBANK.NS',   'Axis Bank Ltd',                     'NSE', 'Financial Services',  'Private Sector Bank',       'LARGE', 2),
  ('ASIANPAINT', 'ASIANPAINT.NS', 'Asian Paints Ltd',                  'NSE', 'Materials',           'Paints',                    'LARGE', 1),
  ('MARUTI',     'MARUTI.NS',     'Maruti Suzuki India Ltd',           'NSE', 'Consumer Discretionary','Automobiles',             'LARGE', 5),
  ('TITAN',      'TITAN.NS',      'Titan Company Ltd',                 'NSE', 'Consumer Discretionary','Jewellery & Watches',     'LARGE', 1),
  ('WIPRO',      'WIPRO.NS',      'Wipro Ltd',                         'NSE', 'Technology',          'IT Services',               'LARGE', 2),
  ('HCLTECH',    'HCLTECH.NS',    'HCL Technologies Ltd',              'NSE', 'Technology',          'IT Services',               'LARGE', 2),
  ('BAJFINANCE', 'BAJFINANCE.NS', 'Bajaj Finance Ltd',                 'NSE', 'Financial Services',  'NBFC',                      'LARGE', 2),
  ('SUNPHARMA',  'SUNPHARMA.NS',  'Sun Pharmaceutical Industries Ltd', 'NSE', 'Healthcare',          'Pharmaceuticals',           'LARGE', 1),
  ('ULTRACEMCO', 'ULTRACEMCO.NS', 'UltraTech Cement Ltd',              'NSE', 'Materials',           'Cement',                    'LARGE', 10),
  ('TATAMOTORS', 'TATAMOTORS.NS', 'Tata Motors Ltd',                   'NSE', 'Consumer Discretionary','Automobiles',             'LARGE', 2),
  ('ADANIENT',   'ADANIENT.NS',   'Adani Enterprises Ltd',             'NSE', 'Industrials',         'Diversified',               'LARGE', 1),
  ('ONGC',       'ONGC.NS',       'Oil & Natural Gas Corporation Ltd', 'NSE', 'Energy',              'Oil & Gas Exploration',     'LARGE', 5)
ON CONFLICT (symbol) DO NOTHING;

-- ─── MUTUAL FUNDS ─────────────────────────────────────────────────────────────
INSERT INTO public.mutual_funds (scheme_code, name, amc, category, sub_category, risk_level, expense_ratio, min_sip, min_lumpsum) VALUES
  ('MF001', 'Axis Bluechip Fund - Direct Growth',              'Axis Mutual Fund',    'Equity',  'Large Cap',        'MODERATELY_HIGH', 0.55, 500,   5000),
  ('MF002', 'Mirae Asset Large Cap Fund - Direct Growth',      'Mirae Asset',         'Equity',  'Large Cap',        'MODERATELY_HIGH', 0.54, 1000,  5000),
  ('MF003', 'SBI Small Cap Fund - Direct Growth',              'SBI Mutual Fund',     'Equity',  'Small Cap',        'VERY_HIGH',       0.70, 500,   5000),
  ('MF004', 'Parag Parikh Flexi Cap Fund - Direct Growth',     'PPFAS Mutual Fund',   'Equity',  'Flexi Cap',        'MODERATELY_HIGH', 0.63, 1000,  1000),
  ('MF005', 'Axis ELSS Tax Saver Fund - Direct Growth',        'Axis Mutual Fund',    'ELSS',    'ELSS',             'MODERATELY_HIGH', 0.62, 500,   500),
  ('MF006', 'Mirae Asset Tax Saver Fund - Direct Growth',      'Mirae Asset',         'ELSS',    'ELSS',             'MODERATELY_HIGH', 0.54, 500,   500),
  ('MF007', 'UTI Nifty 50 Index Fund - Direct Growth',         'UTI Mutual Fund',     'Index',   'Nifty 50',         'MODERATELY_HIGH', 0.20, 500,   5000),
  ('MF008', 'HDFC Index Fund Nifty 50 Plan - Direct Growth',   'HDFC Mutual Fund',    'Index',   'Nifty 50',         'MODERATELY_HIGH', 0.20, 100,   100),
  ('MF009', 'ICICI Pru Equity & Debt Fund - Direct Growth',    'ICICI Prudential',    'Hybrid',  'Aggressive Hybrid','MODERATELY_HIGH', 1.05, 1000,  5000),
  ('MF010', 'HDFC Balanced Advantage Fund - Direct Growth',    'HDFC Mutual Fund',    'Hybrid',  'Balanced Advantage','MODERATELY_HIGH',0.82, 100,   100),
  ('MF011', 'SBI Magnum Gilt Fund - Direct Growth',            'SBI Mutual Fund',     'Debt',    'Gilt',             'MODERATE',        0.48, 5000,  5000)
ON CONFLICT (scheme_code) DO NOTHING;
