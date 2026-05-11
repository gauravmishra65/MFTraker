/*
  # Add nav column to mutual_funds table

  Adds a `nav` (Net Asset Value) column to store the latest NAV fetched from AMFI.
*/

ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS nav float8;
