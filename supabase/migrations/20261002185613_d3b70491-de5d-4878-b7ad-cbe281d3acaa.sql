CREATE TABLE public.cl_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo_empresa_dominio text,
  tipo_processo text NOT NULL DEFAULT '11',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.cl_mapeamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  evento text NOT NULL,
  rubrica text,
  tipo text NOT NULL DEFAULT 'valor' CHECK (tipo IN ('valor','horas','quantidade')),
  ignorar boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, evento)
);
CREATE TABLE public.cl_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome_norm text NOT NULL,
  nome text NOT NULL,
  codigo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome_norm)
);
CREATE TABLE public.cl_conversoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  arquivo_origem text,
  linhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  conteudo_txt text,
  qtd_lancamentos integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cl_conversoes_emp_idx ON public.cl_conversoes(empresa_id, competencia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cl_config, public.cl_mapeamentos, public.cl_funcionarios, public.cl_conversoes TO authenticated;
GRANT ALL ON public.cl_config, public.cl_mapeamentos, public.cl_funcionarios, public.cl_conversoes TO service_role;

ALTER TABLE public.cl_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cl_mapeamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cl_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cl_conversoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.cl_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.cl_mapeamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.cl_funcionarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.cl_conversoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER cl_config_upd BEFORE UPDATE ON public.cl_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cl_map_upd BEFORE UPDATE ON public.cl_mapeamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cl_func_upd BEFORE UPDATE ON public.cl_funcionarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cl_conv_upd BEFORE UPDATE ON public.cl_conversoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();