ALTER TABLE public.cct_analyses ADD COLUMN IF NOT EXISTS client_summary text;
ALTER TABLE public.client_ccts ADD COLUMN IF NOT EXISTS cct_analysis_id uuid REFERENCES public.cct_analyses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_client_ccts_cct_analysis_id ON public.client_ccts(cct_analysis_id);