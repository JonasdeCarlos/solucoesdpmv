ALTER TABLE public.office_branding
  ADD COLUMN IF NOT EXISTS heading_font text NOT NULL DEFAULT 'Helvetica',
  ADD COLUMN IF NOT EXISTS body_font text NOT NULL DEFAULT 'Helvetica',
  ADD COLUMN IF NOT EXISTS brand_manual_url text;