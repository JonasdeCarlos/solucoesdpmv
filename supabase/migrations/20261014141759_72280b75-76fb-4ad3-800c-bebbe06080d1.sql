CREATE TABLE public.escala_links_publicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  pin_hash text,
  expira_em timestamptz,
  limite_escalas int,
  revogado_em timestamptz,
  ultimo_acesso_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_links_publicos TO authenticated;
GRANT ALL ON public.escala_links_publicos TO service_role;
ALTER TABLE public.escala_links_publicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.escala_links_publicos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.escalas_revezamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT '',
  setor text NOT NULL DEFAULT '',
  regime text NOT NULL DEFAULT '6x1',
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  categoria_atividade text NOT NULL DEFAULT 'COMERCIO',
  atividade_anexo_iv text NOT NULL DEFAULT 'nenhuma',
  fundamento_trabalho_domingo text NOT NULL DEFAULT '',
  cct_vigente boolean NOT NULL DEFAULT false,
  cct_registro text NOT NULL DEFAULT '',
  cct_vigencia text NOT NULL DEFAULT '',
  regras_cct jsonb NOT NULL DEFAULT '{}'::jsonb,
  prazo_folga_compensatoria_feriado int NOT NULL DEFAULT 7,
  n_domingos int NOT NULL DEFAULT 3,
  minimo_diario int NOT NULL DEFAULT 0,
  feriados jsonb NOT NULL DEFAULT '[]'::jsonb,
  responsavel_nome text NOT NULL DEFAULT '',
  origem text NOT NULL DEFAULT 'interna',
  link_id uuid REFERENCES public.escala_links_publicos(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'rascunho',
  preenchido_por_nome text NOT NULL DEFAULT '',
  preenchido_por_contato text NOT NULL DEFAULT '',
  aceite_lgpd_em timestamptz,
  observacao_escritorio text NOT NULL DEFAULT '',
  enviado_em timestamptz,
  aprovado_em timestamptz,
  aprovado_por uuid,
  visto_escritorio boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalas_revezamento TO authenticated;
GRANT ALL ON public.escalas_revezamento TO service_role;
ALTER TABLE public.escalas_revezamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.escalas_revezamento FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_escalas_revezamento_upd BEFORE UPDATE ON public.escalas_revezamento FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.escala_funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id uuid NOT NULL REFERENCES public.escalas_revezamento(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  codigo text NOT NULL DEFAULT '',
  nome text NOT NULL DEFAULT '',
  cargo text NOT NULL DEFAULT '',
  sexo text NOT NULL DEFAULT 'M',
  art386_ativo boolean NOT NULL DEFAULT false,
  art386_justificativa_desativacao text NOT NULL DEFAULT '',
  ultima_folga_anterior date,
  ultimo_domingo_folga_anterior date,
  hora_entrada text NOT NULL DEFAULT '',
  hora_saida text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_funcionarios TO authenticated;
GRANT ALL ON public.escala_funcionarios TO service_role;
ALTER TABLE public.escala_funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.escala_funcionarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.escala_dias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id uuid NOT NULL REFERENCES public.escalas_revezamento(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.escala_funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo text NOT NULL DEFAULT 'T',
  UNIQUE (funcionario_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escala_dias TO authenticated;
GRANT ALL ON public.escala_dias TO service_role;
ALTER TABLE public.escala_dias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.escala_dias FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.escala_pin_tentativas (
  link_id uuid PRIMARY KEY REFERENCES public.escala_links_publicos(id) ON DELETE CASCADE,
  falhas int NOT NULL DEFAULT 0,
  bloqueado_ate timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.escala_pin_tentativas TO service_role;
ALTER TABLE public.escala_pin_tentativas ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.escalas_revezamento;