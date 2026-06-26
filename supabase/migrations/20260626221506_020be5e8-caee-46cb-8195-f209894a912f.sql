
CREATE TABLE public.prize_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  verba_label TEXT NOT NULL DEFAULT 'Prêmio',
  verba_label_plural TEXT,
  nome TEXT NOT NULL,
  objetivo TEXT,
  periodo_tipo TEXT NOT NULL DEFAULT 'mensal',
  escopo TEXT NOT NULL DEFAULT 'todos',
  tipo_calculo TEXT NOT NULL DEFAULT 'media_simples',
  valor_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_minimo NUMERIC(12,2),
  arredondamento TEXT NOT NULL DEFAULT 'normal',
  rubrica_codigo TEXT,
  rubrica_descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  aviso_legal TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prize_policies TO authenticated;
GRANT ALL ON public.prize_policies TO service_role;
ALTER TABLE public.prize_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage prize_policies" ON public.prize_policies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_prize_policies_updated BEFORE UPDATE ON public.prize_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.prize_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.prize_policies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  peso NUMERIC(6,2) NOT NULL DEFAULT 1,
  essencial BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  origem TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prize_criteria TO authenticated;
GRANT ALL ON public.prize_criteria TO service_role;
ALTER TABLE public.prize_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage prize_criteria" ON public.prize_criteria FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_prize_criteria_updated BEFORE UPDATE ON public.prize_criteria FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_prize_criteria_policy ON public.prize_criteria(policy_id, ordem);

CREATE TABLE public.prize_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.prize_policies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  matricula TEXT,
  cargo TEXT,
  setor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prize_employees TO authenticated;
GRANT ALL ON public.prize_employees TO service_role;
ALTER TABLE public.prize_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage prize_employees" ON public.prize_employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_prize_employees_updated BEFORE UPDATE ON public.prize_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.prize_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.prize_policies(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'em_apuracao',
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prize_assessments TO authenticated;
GRANT ALL ON public.prize_assessments TO service_role;
ALTER TABLE public.prize_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage prize_assessments" ON public.prize_assessments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_prize_assessments_updated BEFORE UPDATE ON public.prize_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.prize_assessment_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.prize_assessments(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.prize_employees(id) ON DELETE CASCADE,
  percentual_final NUMERIC(6,2),
  valor_final NUMERIC(12,2),
  parecer_geral TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prize_assessment_employees TO authenticated;
GRANT ALL ON public.prize_assessment_employees TO service_role;
ALTER TABLE public.prize_assessment_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage prize_assessment_employees" ON public.prize_assessment_employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_prize_assessment_employees_updated BEFORE UPDATE ON public.prize_assessment_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.prize_assessment_criterion_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_employee_id UUID NOT NULL REFERENCES public.prize_assessment_employees(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES public.prize_criteria(id) ON DELETE CASCADE,
  percentual NUMERIC(6,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  evidencia_url TEXT,
  feedback_ia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_employee_id, criterion_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prize_assessment_criterion_results TO authenticated;
GRANT ALL ON public.prize_assessment_criterion_results TO service_role;
ALTER TABLE public.prize_assessment_criterion_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage prize_criterion_results" ON public.prize_assessment_criterion_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_prize_criterion_results_updated BEFORE UPDATE ON public.prize_assessment_criterion_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.prize_alignment_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_employee_id UUID NOT NULL REFERENCES public.prize_assessment_employees(id) ON DELETE CASCADE,
  pdf_path TEXT,
  assinado_pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prize_alignment_reports TO authenticated;
GRANT ALL ON public.prize_alignment_reports TO service_role;
ALTER TABLE public.prize_alignment_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage prize_alignment_reports" ON public.prize_alignment_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_prize_alignment_reports_updated BEFORE UPDATE ON public.prize_alignment_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.prize_dominio_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES public.prize_assessments(id) ON DELETE CASCADE,
  arquivo_path TEXT NOT NULL,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  total_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  layout_config JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prize_dominio_exports TO authenticated;
GRANT ALL ON public.prize_dominio_exports TO service_role;
ALTER TABLE public.prize_dominio_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage prize_dominio_exports" ON public.prize_dominio_exports FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.client_prize_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  ativo BOOLEAN NOT NULL DEFAULT true,
  default_verba_label TEXT NOT NULL DEFAULT 'Prêmio',
  permissions JSONB NOT NULL DEFAULT '{"policy":true,"criteria":true,"employees":true,"assessment":true,"reports":true}'::jsonb,
  expira_em TIMESTAMPTZ,
  ultimo_acesso TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_prize_links TO authenticated;
GRANT ALL ON public.client_prize_links TO service_role;
ALTER TABLE public.client_prize_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage client_prize_links" ON public.client_prize_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_client_prize_links_updated BEFORE UPDATE ON public.client_prize_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
