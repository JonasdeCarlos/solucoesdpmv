
ALTER TABLE public.prize_policies
  ADD COLUMN IF NOT EXISTS modelo_template text,
  ADD COLUMN IF NOT EXISTS hotelaria_config jsonb,
  ADD COLUMN IF NOT EXISTS hotelaria_pontos jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hotelaria_apuracao jsonb DEFAULT '{}'::jsonb;
