
CREATE TABLE public.auditoria_acao_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  acao_id UUID NOT NULL REFERENCES public.auditoria_acoes(id) ON DELETE CASCADE,
  auditoria_id UUID NOT NULL REFERENCES public.auditorias(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_auditoria_acao_files_acao ON public.auditoria_acao_files(acao_id);
CREATE INDEX idx_auditoria_acao_files_aud ON public.auditoria_acao_files(auditoria_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditoria_acao_files TO anon, authenticated;
GRANT ALL ON public.auditoria_acao_files TO service_role;
ALTER TABLE public.auditoria_acao_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auditoria_acao_files all" ON public.auditoria_acao_files FOR ALL USING (true) WITH CHECK (true);
