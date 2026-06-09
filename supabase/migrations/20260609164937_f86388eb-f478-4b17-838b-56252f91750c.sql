ALTER TABLE public.client_dp_profile
  ADD COLUMN IF NOT EXISTS admissao_modelo_contrato text DEFAULT '',
  ADD COLUMN IF NOT EXISTS admissao_caminho_dominio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS admissao_clausulas_especificas text DEFAULT '';