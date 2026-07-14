
CREATE TABLE public.cct_analysis_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cct_analysis_id UUID NOT NULL REFERENCES public.cct_analyses(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_kind TEXT NOT NULL DEFAULT 'principal', -- principal | aditivo | errata | anexo
  mime_type TEXT,
  size_bytes BIGINT,
  page_count INT,
  ocr_applied BOOLEAN NOT NULL DEFAULT false,
  ocr_text TEXT,
  order_index INT NOT NULL DEFAULT 0,
  uploaded_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cct_analysis_files TO authenticated;
GRANT ALL ON public.cct_analysis_files TO service_role;
ALTER TABLE public.cct_analysis_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cct_analysis_files all auth" ON public.cct_analysis_files FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cct_analysis_files_analysis ON public.cct_analysis_files(cct_analysis_id);
CREATE TRIGGER trg_cct_analysis_files_updated BEFORE UPDATE ON public.cct_analysis_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
