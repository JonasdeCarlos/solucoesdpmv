
CREATE TABLE public.aviso_mensagens_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  texto text NOT NULL,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aviso_mensagens_modelos TO authenticated;
GRANT ALL ON public.aviso_mensagens_modelos TO service_role;
ALTER TABLE public.aviso_mensagens_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read modelos" ON public.aviso_mensagens_modelos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert modelos" ON public.aviso_mensagens_modelos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update modelos" ON public.aviso_mensagens_modelos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete modelos" ON public.aviso_mensagens_modelos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_aviso_mensagens_modelos_updated
  BEFORE UPDATE ON public.aviso_mensagens_modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
