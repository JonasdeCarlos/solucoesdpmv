CREATE TABLE public.transicao_links (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE, token_hash text NOT NULL UNIQUE, expira_em timestamptz, revogado_em timestamptz, created_by uuid, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transicao_links TO authenticated;
GRANT ALL ON public.transicao_links TO service_role;
ALTER TABLE public.transicao_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.transicao_links FOR ALL TO authenticated USING (true) WITH CHECK (true);