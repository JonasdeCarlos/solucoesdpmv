
CREATE TABLE public.auditorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_nome TEXT NOT NULL,
  cnpj TEXT,
  responsavel TEXT,
  consultor TEXT,
  data_inicio DATE,
  objetivo TEXT,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  parecer_final TEXT,
  resumo_diagnostico TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditorias TO anon, authenticated;
GRANT ALL ON public.auditorias TO service_role;
ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auditorias all" ON public.auditorias FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_auditorias_updated BEFORE UPDATE ON public.auditorias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.auditoria_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id UUID NOT NULL REFERENCES public.auditorias(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  area_ordem INT DEFAULT 0,
  item_ordem INT DEFAULT 0,
  titulo TEXT NOT NULL,
  descricao TEXT,
  acao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  documentos TEXT,
  responsavel_empresa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditoria_itens TO anon, authenticated;
GRANT ALL ON public.auditoria_itens TO service_role;
ALTER TABLE public.auditoria_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auditoria_itens all" ON public.auditoria_itens FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_auditoria_itens_updated BEFORE UPDATE ON public.auditoria_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_auditoria_itens_aud ON public.auditoria_itens(auditoria_id);

CREATE TABLE public.auditoria_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id UUID NOT NULL REFERENCES public.auditorias(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.auditoria_itens(id) ON DELETE CASCADE,
  acao_corretiva TEXT NOT NULL,
  responsavel TEXT,
  prazo DATE,
  prioridade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'nao_iniciado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditoria_acoes TO anon, authenticated;
GRANT ALL ON public.auditoria_acoes TO service_role;
ALTER TABLE public.auditoria_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auditoria_acoes all" ON public.auditoria_acoes FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_auditoria_acoes_updated BEFORE UPDATE ON public.auditoria_acoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_auditoria_acoes_aud ON public.auditoria_acoes(auditoria_id);

CREATE TABLE public.cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cbo TEXT,
  area TEXT,
  nivel TEXT,
  entrevista TEXT,
  descricao_sumaria TEXT,
  atividades JSONB DEFAULT '[]'::jsonb,
  requisitos JSONB DEFAULT '{}'::jsonb,
  salario_atual NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargos TO anon, authenticated;
GRANT ALL ON public.cargos TO service_role;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cargos all" ON public.cargos FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cargos_updated BEFORE UPDATE ON public.cargos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_cargos_client ON public.cargos(client_id);

CREATE TABLE public.estruturas_salariais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  faixas JSONB NOT NULL DEFAULT '[]'::jsonb,
  escala_evolucao JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estruturas_salariais TO anon, authenticated;
GRANT ALL ON public.estruturas_salariais TO service_role;
ALTER TABLE public.estruturas_salariais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estruturas_salariais all" ON public.estruturas_salariais FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_estruturas_salariais_updated BEFORE UPDATE ON public.estruturas_salariais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_estruturas_salariais_client ON public.estruturas_salariais(client_id);
