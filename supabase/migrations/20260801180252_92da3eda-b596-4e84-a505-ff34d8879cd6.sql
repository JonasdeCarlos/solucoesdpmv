ALTER TABLE public.cct_radar_settings
  ADD COLUMN IF NOT EXISTS whatsapp_numeros text[] NOT NULL DEFAULT '{}';