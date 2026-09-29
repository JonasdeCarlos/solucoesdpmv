CREATE TABLE public.premiacao_public_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  politica_id UUID NOT NULL REFERENCES public.premiacao_politicas(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  senha_hash TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.premiacao_public_links TO authenticated;
GRANT ALL ON public.premiacao_public_links TO service_role;
ALTER TABLE public.premiacao_public_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.premiacao_public_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_premiacao_public_links_updated_at BEFORE UPDATE ON public.premiacao_public_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();