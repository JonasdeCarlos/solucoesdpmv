CREATE TABLE public.lb_tabela_inss (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vigencia_inicio date NOT NULL,
  faixa int NOT NULL,
  limite_superior numeric(12,2) NOT NULL,
  aliquota numeric(6,4) NOT NULL,
  parcela_deduzir numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vigencia_inicio, faixa)
);
CREATE TABLE public.lb_tabela_irrf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vigencia_inicio date NOT NULL,
  faixa int NOT NULL,
  limite_superior numeric(12,2),
  aliquota numeric(6,4) NOT NULL,
  parcela_deduzir numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vigencia_inicio, faixa)
);
CREATE TABLE public.lb_parametros_irrf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vigencia_inicio date NOT NULL UNIQUE,
  deducao_dependente numeric(12,2) NOT NULL,
  desconto_simplificado numeric(12,2) NOT NULL,
  redutor_limite_isencao numeric(12,2) NOT NULL,
  redutor_valor_max numeric(12,2) NOT NULL,
  redutor_limite_final numeric(12,2) NOT NULL,
  redutor_constante numeric(12,2) NOT NULL,
  redutor_coeficiente numeric(10,6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lb_simulacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  empresa_id uuid NULL,
  empregado text,
  cargo text,
  competencia date NOT NULL,
  liquido_alvo numeric(12,2) NOT NULL,
  parametros jsonb NOT NULL,
  resultado jsonb NOT NULL
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lb_tabela_inss','lb_tabela_irrf','lb_parametros_irrf','lb_simulacoes'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

CREATE TRIGGER update_lb_simulacoes_updated_at BEFORE UPDATE ON public.lb_simulacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.lb_tabela_inss (vigencia_inicio, faixa, limite_superior, aliquota, parcela_deduzir) VALUES
('2026-01-01',1,1621.00,0.075,0.00),
('2026-01-01',2,2902.84,0.09,24.32),
('2026-01-01',3,4354.27,0.12,111.40),
('2026-01-01',4,8475.55,0.14,198.49);

INSERT INTO public.lb_tabela_irrf (vigencia_inicio, faixa, limite_superior, aliquota, parcela_deduzir) VALUES
('2026-01-01',1,2428.80,0,0.00),
('2026-01-01',2,2826.65,0.075,182.16),
('2026-01-01',3,3751.05,0.15,394.16),
('2026-01-01',4,4664.68,0.225,675.49),
('2026-01-01',5,NULL,0.275,908.73);

INSERT INTO public.lb_parametros_irrf (vigencia_inicio, deducao_dependente, desconto_simplificado, redutor_limite_isencao, redutor_valor_max, redutor_limite_final, redutor_constante, redutor_coeficiente) VALUES
('2026-01-01',189.59,607.20,5000.00,312.89,7350.00,978.62,0.133145);