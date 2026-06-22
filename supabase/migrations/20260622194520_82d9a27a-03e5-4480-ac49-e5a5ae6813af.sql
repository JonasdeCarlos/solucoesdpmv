ALTER TABLE public.cargos
  ADD COLUMN IF NOT EXISTS piso_salarial numeric,
  ADD COLUMN IF NOT EXISTS piso_referencia text;