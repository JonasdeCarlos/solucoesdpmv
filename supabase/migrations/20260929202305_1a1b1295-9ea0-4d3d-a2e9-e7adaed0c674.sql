CREATE TABLE public.premio_modelos_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  escopo text NOT NULL DEFAULT 'premio',
  ref_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'politica',
  nome text NOT NULL DEFAULT '',
  arquivo_nome text,
  pdf_base64 text NOT NULL,
  campos jsonb NOT NULL DEFAULT '[]'::jsonb,
  usar_personalizado boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX premio_modelos_documento_ref_idx ON public.premio_modelos_documento(ref_id, tipo);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.premio_modelos_documento TO authenticated;
GRANT ALL ON public.premio_modelos_documento TO service_role;
ALTER TABLE public.premio_modelos_documento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access premio_modelos_documento" ON public.premio_modelos_documento FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_premio_modelos_documento_updated_at BEFORE UPDATE ON public.premio_modelos_documento FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();