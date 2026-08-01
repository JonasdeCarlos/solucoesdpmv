ALTER TABLE public.client_ccts
  ADD COLUMN IF NOT EXISTS radar_site_oficial text,
  ADD COLUMN IF NOT EXISTS radar_cnpjs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS radar_termos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS radar_mediador_registro text,
  ADD COLUMN IF NOT EXISTS radar_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.cct_radar_settings
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz;