ALTER TABLE public.prize_policies
  ADD COLUMN IF NOT EXISTS hotelaria_apuracoes jsonb DEFAULT '{}'::jsonb;

UPDATE public.prize_policies
SET hotelaria_apuracoes = jsonb_build_object(to_char(now(), 'YYYY-MM'), hotelaria_apuracao)
WHERE hotelaria_apuracoes = '{}'::jsonb
  AND hotelaria_apuracao IS NOT NULL
  AND hotelaria_apuracao <> '{}'::jsonb;