CREATE TABLE public.recibo_avulso_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 label text NOT NULL DEFAULT '',
 total numeric NOT NULL DEFAULT 0,
 data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recibo_avulso_history TO authenticated;
GRANT ALL ON public.recibo_avulso_history TO service_role;
ALTER TABLE public.recibo_avulso_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated office receipt access" ON public.recibo_avulso_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_recibo_avulso_history_updated_at BEFORE UPDATE ON public.recibo_avulso_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();