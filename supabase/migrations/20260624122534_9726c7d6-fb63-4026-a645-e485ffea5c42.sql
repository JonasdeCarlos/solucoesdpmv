
CREATE TABLE public.aviso_mensagens_enviadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.aviso_empresas(id) ON DELETE CASCADE,
  empresa_code text,
  empresa_name text,
  mensagem text NOT NULL,
  enviado_por uuid,
  sucesso boolean NOT NULL DEFAULT true,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aviso_mensagens_enviadas TO authenticated;
GRANT ALL ON public.aviso_mensagens_enviadas TO service_role;
ALTER TABLE public.aviso_mensagens_enviadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read mensagens" ON public.aviso_mensagens_enviadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert mensagens" ON public.aviso_mensagens_enviadas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth delete mensagens" ON public.aviso_mensagens_enviadas FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_aviso_mensagens_empresa ON public.aviso_mensagens_enviadas(empresa_id, created_at DESC);
CREATE INDEX idx_aviso_mensagens_created ON public.aviso_mensagens_enviadas(created_at DESC);
