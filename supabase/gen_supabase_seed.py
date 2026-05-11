#!/usr/bin/env python3
"""
Generate Supabase seed SQL for the gmishra.org project.

Downloads:
  - NSE equity master  -> https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv
  - AMFI MF NAV file   -> https://www.amfiindia.com/spages/NAVAll.txt

Produces:
  - out/nse_stocks.sql
  - out/mutual_funds.sql

Paste each file into Supabase Dashboard -> SQL Editor and Run.
"""

from __future__ import annotations

import csv
import os
import sys
import urllib.request
from pathlib import Path

NSE_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"
UA = "Mozilla/5.0"

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
OUT.mkdir(exist_ok=True)


def fetch(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"  cached: {dest}")
        return
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r, dest.open("wb") as f:
        f.write(r.read())
    print(f"  saved : {dest} ({dest.stat().st_size:,} bytes)")


def sql_str(s: str | None) -> str:
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''").strip() + "'"


def gen_stocks() -> None:
    print("Fetching NSE master...")
    src = OUT / "EQUITY_L.csv"
    fetch(NSE_URL, src)

    rows: list[tuple] = []
    with src.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = [h.strip().upper() for h in next(reader)]
        # SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
        idx = {k: i for i, k in enumerate(header)}
        for r in reader:
            if not r or len(r) < 8:
                continue
            symbol = r[idx["SYMBOL"]].strip()
            name = r[idx["NAME OF COMPANY"]].strip()
            series = r[idx["SERIES"]].strip()
            isin = r[idx["ISIN NUMBER"]].strip()
            try:
                face_value = float(r[idx["FACE VALUE"]].strip())
            except ValueError:
                face_value = None
            # Stick to EQ series (regular equity). Drops SME, debt, etc.
            if series != "EQ":
                continue
            rows.append((symbol, f"{symbol}.NS", name, isin, face_value))

    out = OUT / "nse_stocks.sql"
    with out.open("w", encoding="utf-8") as w:
        w.write("-- NSE equity master seed for Supabase project phxfztxxlkyhvtidriqa\n")
        w.write(f"-- Source: {NSE_URL}\n")
        w.write(f"-- Rows: {len(rows)}\n\n")
        w.write("ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;\n")
        w.write("DO $$ BEGIN\n")
        w.write("  IF NOT EXISTS (SELECT 1 FROM pg_policies\n")
        w.write("                 WHERE schemaname='public' AND tablename='stocks'\n")
        w.write("                   AND policyname='stocks_read_all') THEN\n")
        w.write("    CREATE POLICY stocks_read_all ON public.stocks FOR SELECT USING (true);\n")
        w.write("  END IF;\n")
        w.write("END$$;\n\n")
        w.write(
            "INSERT INTO public.stocks "
            "(symbol, yahoo_symbol, name, exchange, isin, face_value) VALUES\n"
        )
        lines = []
        for symbol, yahoo, name, isin, fv in rows:
            lines.append(
                "  ("
                + ", ".join(
                    [
                        sql_str(symbol),
                        sql_str(yahoo),
                        sql_str(name),
                        "'NSE'",
                        sql_str(isin or None),
                        "NULL" if fv is None else f"{fv}",
                    ]
                )
                + ")"
            )
        w.write(",\n".join(lines))
        w.write(
            "\nON CONFLICT (symbol) DO UPDATE SET\n"
            "  yahoo_symbol = EXCLUDED.yahoo_symbol,\n"
            "  name         = EXCLUDED.name,\n"
            "  exchange     = EXCLUDED.exchange,\n"
            "  isin         = COALESCE(EXCLUDED.isin, public.stocks.isin),\n"
            "  face_value   = COALESCE(EXCLUDED.face_value, public.stocks.face_value);\n\n"
            "SELECT count(*) AS stock_count FROM public.stocks;\n"
        )
    print(f"  wrote {out} ({len(rows)} stocks)")


# AMFI file structure:
#   header line
#   blank
#   "Open Ended Schemes(Equity Scheme - Large Cap Fund)"   <- category
#   blank
#   "Aditya Birla Sun Life Mutual Fund"                    <- AMC
#   blank
#   "<code>;<isin1>;<isin2>;<name>;<nav>;<date>"           <- data
#   ...
#   blank lines and repeats
#
# We track the current category + AMC as we walk the file.


def gen_mfs() -> None:
    print("Fetching AMFI NAV...")
    src = OUT / "NAVAll.txt"
    fetch(AMFI_URL, src)

    seen: set[str] = set()
    rows: list[tuple] = []
    category = None
    sub_category = None
    amc = None

    with src.open(encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("Scheme Code"):
                continue
            # Data line has 5 or more semicolons.
            if ";" in line and line.count(";") >= 5:
                parts = [p.strip() for p in line.split(";")]
                if len(parts) < 6:
                    continue
                code, _isin1, _isin2, name, nav_str, _date = parts[:6]
                if not code.isdigit():
                    continue
                if code in seen:
                    continue
                seen.add(code)
                try:
                    nav = float(nav_str) if nav_str not in ("N.A.", "", "-") else None
                except ValueError:
                    nav = None
                # Skip dividend-payout / IDCW variants — AMFI lists 5-10
                # plan flavours per scheme; we keep direct-growth which is
                # what retail trackers use. Heuristic on name:
                upper = name.upper()
                is_direct = "DIRECT" in upper
                is_growth = "GROWTH" in upper or (
                    "IDCW" not in upper and "DIVIDEND" not in upper
                )
                if not (is_direct and is_growth):
                    continue
                rows.append((code, name, amc, category, sub_category, nav))
            else:
                # Non-data line: either a section header or AMC name.
                if "Schemes" in line and "(" in line:
                    # "Open Ended Schemes(Equity Scheme - Large Cap Fund)"
                    after = line.split("(", 1)[1].rstrip(")")
                    if " - " in after:
                        category, sub_category = [s.strip() for s in after.split(" - ", 1)]
                    else:
                        category, sub_category = after.strip(), None
                elif line.lower().endswith("mutual fund") or line.lower().endswith(
                    "asset management company limited"
                ):
                    amc = line

    out = OUT / "mutual_funds.sql"
    with out.open("w", encoding="utf-8") as w:
        w.write("-- AMFI mutual fund master seed for Supabase project phxfztxxlkyhvtidriqa\n")
        w.write(f"-- Source: {AMFI_URL}\n")
        w.write(f"-- Filtered to Direct/Growth schemes. Rows: {len(rows)}\n\n")
        w.write("ALTER TABLE public.mutual_funds ENABLE ROW LEVEL SECURITY;\n")
        w.write("DO $$ BEGIN\n")
        w.write("  IF NOT EXISTS (SELECT 1 FROM pg_policies\n")
        w.write("                 WHERE schemaname='public' AND tablename='mutual_funds'\n")
        w.write("                   AND policyname='mutual_funds_read_all') THEN\n")
        w.write("    CREATE POLICY mutual_funds_read_all ON public.mutual_funds FOR SELECT USING (true);\n")
        w.write("  END IF;\n")
        w.write("END$$;\n\n")

        # Insert in batches of 500 to keep individual statements modest.
        BATCH = 500
        for i in range(0, len(rows), BATCH):
            chunk = rows[i : i + BATCH]
            w.write(
                "INSERT INTO public.mutual_funds "
                "(scheme_code, name, amc, category, sub_category, nav) VALUES\n"
            )
            lines = []
            for code, name, amc_, cat, sub, nav in chunk:
                lines.append(
                    "  ("
                    + ", ".join(
                        [
                            sql_str(code),
                            sql_str(name),
                            sql_str(amc_),
                            sql_str(cat),
                            sql_str(sub),
                            "NULL" if nav is None else f"{nav}",
                        ]
                    )
                    + ")"
                )
            w.write(",\n".join(lines))
            w.write(
                "\nON CONFLICT (scheme_code) DO UPDATE SET\n"
                "  name         = EXCLUDED.name,\n"
                "  amc          = COALESCE(EXCLUDED.amc, public.mutual_funds.amc),\n"
                "  category     = COALESCE(EXCLUDED.category, public.mutual_funds.category),\n"
                "  sub_category = COALESCE(EXCLUDED.sub_category, public.mutual_funds.sub_category),\n"
                "  nav          = COALESCE(EXCLUDED.nav, public.mutual_funds.nav);\n\n"
            )

        w.write("SELECT count(*) AS fund_count FROM public.mutual_funds;\n")
    print(f"  wrote {out} ({len(rows)} funds)")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    if target in ("all", "stocks"):
        gen_stocks()
    if target in ("all", "mfs"):
        gen_mfs()
    print("Done.")
