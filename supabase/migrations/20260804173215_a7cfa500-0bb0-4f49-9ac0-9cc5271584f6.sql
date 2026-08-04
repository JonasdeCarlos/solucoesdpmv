CREATE TABLE public.cct_comparacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_anterior_id uuid REFERENCES public.cct_analyses(id) ON DELETE CASCADE,
  analise_nova_id uuid REFERENCES public.cct_analyses(id) ON DELETE CASCADE,
  resumo text,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cct_comparacoes TO authenticated;
GRANT ALL ON public.cct_comparacoes TO service_role;

ALTER TABLE public.cct_comparacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam comparações de CCT"
ON public.cct_comparacoes FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_cct_comparacoes_updated
BEFORE UPDATE ON public.cct_comparacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cct_comparacoes_nova ON public.cct_comparacoes(analise_nova_id);

ALTER TABLE public.cct_analyses
  ADD COLUMN IF NOT EXISTS parent_analysis_id uuid REFERENCES public.cct_analyses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS derived_from_finding_id uuid,
  ADD COLUMN IF NOT EXISTS derivation_type text,
  ADD COLUMN IF NOT EXISTS derivation_changes jsonb NOT NULL DEFAULT '[]'::jsonb;