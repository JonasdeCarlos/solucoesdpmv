CREATE TABLE public.fb_config_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  divisor numeric(8,2) NOT NULL DEFAULT 220,
  tolerancia numeric(8,2) NOT NULL DEFAULT 0.05,
  criterio_ajuste text NOT NULL DEFAULT 'mais_proximo',
  teto_quinquenio numeric(5,2),
  limite_he_diario numeric(6,2) NOT NULL DEFAULT 2,
  formato_horas text NOT NULL DEFAULT 'hhmm',
  codigo_empresa_dominio text,
  tipo_processo text NOT NULL DEFAULT '11',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fb_config_rubricas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  verba text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'variavel',
  codigo_rubrica_dominio text,
  fator numeric(10,4) NOT NULL DEFAULT 0,
  valor_fixo numeric(14,2),
  percentual_salario numeric(8,4),
  gera_dsr boolean NOT NULL DEFAULT false,
  integra_base_hora boolean NOT NULL DEFAULT false,
  exporta boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, verba)
);
CREATE TABLE public.fb_feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data date NOT NULL,
  descricao text NOT NULL DEFAULT '',
  abrangencia text NOT NULL DEFAULT 'municipal',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, data)
);
CREATE TABLE public.fb_modelos_distribuicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  padrao boolean NOT NULL DEFAULT false,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fb_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  cpf text,
  salario_base numeric(14,2) NOT NULL DEFAULT 0,
  data_admissao date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE TABLE public.fb_competencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  dias_uteis int NOT NULL DEFAULT 25,
  dias_dsr int NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'rascunho',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, competencia)
);
CREATE TABLE public.fb_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_id uuid NOT NULL REFERENCES public.fb_competencias(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.fb_funcionarios(id) ON DELETE CASCADE,
  salario_base numeric(14,2),
  data_admissao date,
  anos_completos int,
  perc_quinquenio numeric(5,2),
  valor_quinquenio numeric(14,2),
  hora_base numeric(14,8),
  bruto_alvo numeric(14,2),
  bruto_previsto numeric(14,2),
  diferenca numeric(14,2),
  bruto_dominio numeric(14,2),
  diferenca_dominio numeric(14,2),
  status text,
  detalhe jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competencia_id, funcionario_id)
);
CREATE TABLE public.fb_lancamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id uuid NOT NULL REFERENCES public.fb_lancamentos(id) ON DELETE CASCADE,
  verba text NOT NULL,
  modo text NOT NULL DEFAULT 'percentual',
  percentual numeric(8,4),
  minutos int,
  horas_decimal numeric(10,4),
  horas_hhmm text,
  horas_ponto numeric(10,4),
  valor numeric(14,2),
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lancamento_id, verba)
);
CREATE TABLE public.fb_exportacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_id uuid NOT NULL REFERENCES public.fb_competencias(id) ON DELETE CASCADE,
  arquivo_nome text NOT NULL,
  conteudo text NOT NULL,
  gerado_por uuid,
  gerado_em timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['fb_config_empresa','fb_config_rubricas','fb_feriados','fb_modelos_distribuicao','fb_funcionarios','fb_competencias','fb_lancamentos','fb_lancamento_itens','fb_exportacoes'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['fb_config_empresa','fb_config_rubricas','fb_modelos_distribuicao','fb_funcionarios','fb_competencias','fb_lancamentos'] LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;