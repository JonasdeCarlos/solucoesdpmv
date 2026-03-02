
-- Storage bucket for timecard uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('ponto-uploads', 'ponto-uploads', false);

-- Allow anyone to upload (no auth in this app)
CREATE POLICY "Allow all uploads to ponto-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ponto-uploads');

CREATE POLICY "Allow all reads from ponto-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'ponto-uploads');

CREATE POLICY "Allow all deletes from ponto-uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'ponto-uploads');

-- Audit table for OCR imports
CREATE TABLE public.ponto_ocr_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_nome text NOT NULL,
  arquivo_path text,
  mes_ano text NOT NULL,
  empregado_nome text,
  resultado_ocr jsonb,
  alteracoes_manuais jsonb,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ponto_ocr_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to ponto_ocr_audit"
ON public.ponto_ocr_audit FOR ALL
USING (true)
WITH CHECK (true);
