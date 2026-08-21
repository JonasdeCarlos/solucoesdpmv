CREATE TABLE IF NOT EXISTS public.bh_empresa_config (
  empresa_cnpj text PRIMARY KEY,
  empresa_nome text,
  logo_data_url text,
  periodo_inicio date,
  periodo_fim date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bh_empresa_config TO authenticated;
GRANT ALL ON public.bh_empresa_config TO service_role;
ALTER TABLE public.bh_empresa_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access bh_empresa_config" ON public.bh_empresa_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_bh_empresa_config_updated_at BEFORE UPDATE ON public.bh_empresa_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();