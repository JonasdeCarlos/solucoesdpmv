CREATE TABLE public.ts_empresa_config (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
 regime_tributario text NOT NULL DEFAULT 'simples' CHECK (regime_tributario IN ('simples','demais')),
 codigo_empresa_dominio text CHECK (codigo_empresa_dominio IS NULL OR codigo_empresa_dominio ~ '^\d{0,10}$'),
 codigo_verba_padrao text CHECK (codigo_verba_padrao IS NULL OR codigo_verba_padrao ~ '^\d{0,4}$'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.ts_funcionarios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
 codigo text NOT NULL CHECK (codigo ~ '^\d{1,10}$'), nome text NOT NULL, ativo boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(empresa_id, codigo));
CREATE TABLE public.ts_competencias (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
 competencia date NOT NULL,
 valor_arrecadado numeric(14,2) NOT NULL DEFAULT 0, percentual_retencao numeric(5,2) NOT NULL DEFAULT 0,
 valor_retido numeric(14,2) NOT NULL DEFAULT 0, saldo_utilizado numeric(14,2) NOT NULL DEFAULT 0,
 valor_liquido numeric(14,2) NOT NULL DEFAULT 0, codigo_verba text, tipo_processo text NOT NULL DEFAULT '11',
 saldo_nao_distribuido numeric(14,2) NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','calculado','exportado','ajustado')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id, competencia));
CREATE TABLE public.ts_distribuicao (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 competencia_id uuid NOT NULL REFERENCES public.ts_competencias(id) ON DELETE CASCADE,
 funcionario_id uuid NOT NULL REFERENCES public.ts_funcionarios(id) ON DELETE CASCADE,
 pontos numeric(10,2) NOT NULL DEFAULT 0, valor_comissao numeric(14,2) NOT NULL DEFAULT 0,
 rendimento_bruto_extrato numeric(14,2), valor_bruto_alvo numeric(14,2), diferenca numeric(14,2),
 valor_ajustado numeric(14,2), alerta text, UNIQUE(competencia_id, funcionario_id));
CREATE TABLE public.ts_exportacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 competencia_id uuid NOT NULL REFERENCES public.ts_competencias(id) ON DELETE CASCADE,
 tipo text NOT NULL CHECK (tipo IN ('original','ajustado')), nome_arquivo text NOT NULL, conteudo text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ts_empresa_config, public.ts_funcionarios, public.ts_competencias, public.ts_distribuicao, public.ts_exportacoes TO authenticated;
GRANT ALL ON public.ts_empresa_config, public.ts_funcionarios, public.ts_competencias, public.ts_distribuicao, public.ts_exportacoes TO service_role;

ALTER TABLE public.ts_empresa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_competencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_distribuicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_exportacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.ts_empresa_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.ts_funcionarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.ts_competencias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.ts_distribuicao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.ts_exportacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ts_empresa_config_updated BEFORE UPDATE ON public.ts_empresa_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ts_competencias_updated BEFORE UPDATE ON public.ts_competencias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE VIEW public.ts_saldo_empresa WITH (security_invoker = true) AS
SELECT empresa_id,
 COALESCE(SUM(saldo_nao_distribuido) FILTER (WHERE status='ajustado'),0)::numeric(14,2) AS saldo_gerado,
 COALESCE(SUM(saldo_utilizado) FILTER (WHERE status IN ('exportado','ajustado')),0)::numeric(14,2) AS saldo_consumido,
 (COALESCE(SUM(saldo_nao_distribuido) FILTER (WHERE status='ajustado'),0) - COALESCE(SUM(saldo_utilizado) FILTER (WHERE status IN ('exportado','ajustado')),0))::numeric(14,2) AS saldo_acumulado
FROM public.ts_competencias GROUP BY empresa_id;
GRANT SELECT ON public.ts_saldo_empresa TO authenticated, service_role;

CREATE FUNCTION public.ts_saldo_disponivel(p_empresa_id uuid, p_competencia_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 WITH ref AS (SELECT competencia FROM public.ts_competencias WHERE id = p_competencia_id)
 SELECT (
  COALESCE((SELECT SUM(c.saldo_nao_distribuido) FROM public.ts_competencias c WHERE c.empresa_id=p_empresa_id AND c.status='ajustado'
     AND c.competencia < COALESCE((SELECT competencia FROM ref), 'infinity'::date)),0)
  - COALESCE((SELECT SUM(c.saldo_utilizado) FROM public.ts_competencias c WHERE c.empresa_id=p_empresa_id AND c.status IN ('exportado','ajustado')
     AND c.id IS DISTINCT FROM p_competencia_id),0)
 )::numeric(14,2)
$$;
GRANT EXECUTE ON FUNCTION public.ts_saldo_disponivel(uuid, uuid) TO authenticated, service_role;