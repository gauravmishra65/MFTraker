/*
  # Seed master data: 23 NSE stocks and 11 mutual funds

  Inserts all Indian stock and mutual fund master data.
  Uses ON CONFLICT DO NOTHING to be idempotent.
*/

-- ─── STOCKS ───────────────────────────────────────────────────────────────────
INSERT INTO public.stocks (symbol, yahoo_symbol, name, exchange, sector, cap_category, isin) VALUES
  ('RELIANCE',   'RELIANCE.NS',   'Reliance Industries Ltd',        'NSE', 'Energy',       'LARGE', 'INE002A01018'),
  ('TCS',        'TCS.NS',        'Tata Consultancy Services Ltd',  'NSE', 'IT',            'LARGE', 'INE467B01029'),
  ('HDFCBANK',   'HDFCBANK.NS',   'HDFC Bank Ltd',                  'NSE', 'Financials',   'LARGE', 'INE040A01034'),
  ('INFY',       'INFY.NS',       'Infosys Ltd',                    'NSE', 'IT',            'LARGE', 'INE009A01021'),
  ('ICICIBANK',  'ICICIBANK.NS',  'ICICI Bank Ltd',                 'NSE', 'Financials',   'LARGE', 'INE090A01021'),
  ('HINDUNILVR', 'HINDUNILVR.NS', 'Hindustan Unilever Ltd',         'NSE', 'FMCG',         'LARGE', 'INE030A01027'),
  ('BHARTIARTL', 'BHARTIARTL.NS', 'Bharti Airtel Ltd',              'NSE', 'Telecom',      'LARGE', 'INE397D01024'),
  ('ITC',        'ITC.NS',        'ITC Ltd',                        'NSE', 'FMCG',         'LARGE', 'INE154A01025'),
  ('SBIN',       'SBIN.NS',       'State Bank of India',            'NSE', 'Financials',   'LARGE', 'INE062A01020'),
  ('LT',         'LT.NS',         'Larsen & Toubro Ltd',            'NSE', 'Construction', 'LARGE', 'INE018A01030'),
  ('KOTAKBANK',  'KOTAKBANK.NS',  'Kotak Mahindra Bank Ltd',        'NSE', 'Financials',   'LARGE', 'INE237A01028'),
  ('AXISBANK',   'AXISBANK.NS',   'Axis Bank Ltd',                  'NSE', 'Financials',   'LARGE', 'INE238A01034'),
  ('MARUTI',     'MARUTI.NS',     'Maruti Suzuki India Ltd',        'NSE', 'Auto',         'LARGE', 'INE585B01010'),
  ('TATAMOTORS', 'TATAMOTORS.NS', 'Tata Motors Ltd',                'NSE', 'Auto',         'LARGE', 'INE155A01022'),
  ('WIPRO',      'WIPRO.NS',      'Wipro Ltd',                      'NSE', 'IT',            'LARGE', 'INE075A01022'),
  ('ASIANPAINT', 'ASIANPAINT.NS', 'Asian Paints Ltd',               'NSE', 'Consumer',     'LARGE', 'INE021A01026'),
  ('SUNPHARMA',  'SUNPHARMA.NS',  'Sun Pharmaceutical Industries',  'NSE', 'Pharma',       'LARGE', 'INE044A01036'),
  ('TITAN',      'TITAN.NS',      'Titan Company Ltd',              'NSE', 'Consumer',     'LARGE', 'INE280A01028'),
  ('BAJFINANCE', 'BAJFINANCE.NS', 'Bajaj Finance Ltd',              'NSE', 'Financials',   'LARGE', 'INE296A01024'),
  ('ADANIENT',   'ADANIENT.NS',   'Adani Enterprises Ltd',          'NSE', 'Diversified',  'LARGE', 'INE423A01024'),
  ('NESTLEIND',  'NESTLEIND.NS',  'Nestle India Ltd',               'NSE', 'FMCG',         'LARGE', 'INE239A01016'),
  ('ULTRACEMCO', 'ULTRACEMCO.NS', 'UltraTech Cement Ltd',           'NSE', 'Cement',       'LARGE', 'INE481G01011'),
  ('HCLTECH',    'HCLTECH.NS',    'HCL Technologies Ltd',           'NSE', 'IT',            'LARGE', 'INE860A01027')
ON CONFLICT (symbol) DO NOTHING;

-- ─── MUTUAL FUNDS ─────────────────────────────────────────────────────────────
INSERT INTO public.mutual_funds (scheme_code, name, amc, category, sub_category, risk_level, expense_ratio, aum, min_sip, min_lumpsum, fund_manager, benchmark) VALUES
  ('120503', 'Axis Bluechip Fund - Direct Growth',            'Axis MF',         'Equity', 'Large Cap',  'Very High', 0.60, 53000, 500,  5000, 'Shreyash Devalkar',   'Nifty 50 TRI'),
  ('120465', 'Mirae Asset Large Cap Fund - Direct Growth',    'Mirae Asset MF',  'Equity', 'Large Cap',  'Very High', 0.50, 38500, 1000, 5000, 'Gaurav Misra',        'Nifty 100 TRI'),
  ('118989', 'SBI Small Cap Fund - Direct Growth',            'SBI MF',          'Equity', 'Small Cap',  'Very High', 0.70, 25800, 500,  5000, 'R. Srinivasan',       'BSE Small Cap TRI'),
  ('120586', 'Parag Parikh Flexi Cap Fund - Direct Growth',   'PPFAS MF',        'Equity', 'Flexi Cap',  'Very High', 0.70, 65000, 1000, 1000, 'Rajeev Thakkar',      'Nifty 500 TRI'),
  ('119598', 'Mirae Asset Tax Saver Fund - Direct Growth',    'Mirae Asset MF',  'ELSS',   'ELSS',       'Very High', 0.60, 18900, 500,  500,  'Neelesh Surana',      'Nifty 200 TRI'),
  ('120716', 'UTI Nifty 50 Index Fund - Direct Growth',       'UTI MF',          'Index',  'Large Cap',  'Very High', 0.20, 14500, 500,  5000, 'Sharwan Kumar Goyal', 'Nifty 50 TRI'),
  ('147949', 'ICICI Prudential Nifty Next 50 Index - Direct', 'ICICI Pru MF',    'Index',  'Mid Cap',    'Very High', 0.30, 3500,  500,  5000, 'Kayzad Eghlim',       'Nifty Next 50 TRI'),
  ('118473', 'HDFC Balanced Advantage Fund - Direct Growth',  'HDFC MF',         'Hybrid', 'Balanced',   'High',      0.85, 70000, 500,  5000, 'Anil Bamboli',        'Nifty 50 Hybrid TRI'),
  ('118835', 'Kotak Equity Hybrid Fund - Direct Growth',      'Kotak MF',        'Hybrid', 'Aggressive', 'High',      0.70, 4200,  1000, 5000, 'Pankaj Tibrewal',     'Nifty 50 TRI'),
  ('120669', 'Axis Liquid Fund - Direct Growth',              'Axis MF',         'Debt',   'Liquid',     'Low',       0.15, 30100, 1000, 500,  'Devang Shah',         'NIFTY Liquid Index'),
  ('118778', 'Nippon India Small Cap Fund - Direct Growth',   'Nippon India MF', 'Equity', 'Small Cap',  'Very High', 0.70, 41000, 100,  5000, 'Samir Rachh',         'BSE Small Cap TRI')
ON CONFLICT (scheme_code) DO NOTHING;
