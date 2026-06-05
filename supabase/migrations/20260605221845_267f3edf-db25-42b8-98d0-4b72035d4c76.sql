
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_cliente text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text DEFAULT '',
  ADD COLUMN IF NOT EXISTS municipio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf text DEFAULT '',
  ADD COLUMN IF NOT EXISTS segmento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contato_nome text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contato_telefone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS contato_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';

CREATE UNIQUE INDEX IF NOT EXISTS clientes_codigo_unique
  ON public.clientes(codigo_cliente) WHERE codigo_cliente IS NOT NULL AND codigo_cliente <> '';
CREATE INDEX IF NOT EXISTS clientes_cnpj_idx ON public.clientes(cnpj);

CREATE SCHEMA IF NOT EXISTS dp_private;
REVOKE ALL ON SCHEMA dp_private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS dp_private.enc_keys (
  id int PRIMARY KEY DEFAULT 1,
  key text NOT NULL,
  CONSTRAINT enc_keys_singleton CHECK (id = 1)
);
INSERT INTO dp_private.enc_keys (id, key)
VALUES (1, encode(gen_random_bytes(32), 'base64'))
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION dp_private.get_key() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = dp_private
AS $$ SELECT key FROM dp_private.enc_keys WHERE id = 1 $$;

CREATE TABLE public.client_dp_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  digisac_contact_name text DEFAULT '',
  digisac_contact_id text DEFAULT '',
  channel_default text DEFAULT 'whatsapp',
  best_contact_time text DEFAULT '',
  sla_hours int DEFAULT 24,
  has_timeclock boolean DEFAULT false,
  timeclock_type text DEFAULT '',
  timeclock_owner text DEFAULT '',
  timeclock_url text DEFAULT '',
  timeclock_user text DEFAULT '',
  timeclock_password_encrypted bytea,
  timeclock_notes text DEFAULT '',
  manual_send_method text DEFAULT '',
  manual_send_frequency text DEFAULT '',
  has_variables boolean DEFAULT false,
  variables_how text DEFAULT '',
  variables_deadline_day int,
  variables_responsible text DEFAULT '',
  needs_preview boolean DEFAULT false,
  preview_deadline_day int,
  preview_channel text DEFAULT '',
  preview_rules text DEFAULT '',
  workload_type text DEFAULT 'fixa',
  workload_hhmm text DEFAULT '',
  workload_rules text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_dp_profile TO authenticated;
GRANT ALL ON public.client_dp_profile TO service_role;
ALTER TABLE public.client_dp_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read dp profile" ON public.client_dp_profile FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth ins dp profile" ON public.client_dp_profile FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth upd dp profile" ON public.client_dp_profile FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin del dp profile" ON public.client_dp_profile FOR DELETE TO authenticated USING (public.is_admin_or_master(auth.uid()));
CREATE TRIGGER trg_dp_profile_updated BEFORE UPDATE ON public.client_dp_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_timeclock_password(_client_id uuid, _password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, dp_private
AS $$
BEGIN
  IF NOT public.is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE public.client_dp_profile
    SET timeclock_password_encrypted = CASE
      WHEN _password IS NULL OR _password = '' THEN NULL
      ELSE pgp_sym_encrypt(_password, dp_private.get_key())
    END
    WHERE client_id = _client_id;
END $$;
GRANT EXECUTE ON FUNCTION public.set_timeclock_password(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_timeclock_password(_client_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, dp_private
AS $$
DECLARE _enc bytea;
BEGIN
  IF NOT public.is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT timeclock_password_encrypted INTO _enc FROM public.client_dp_profile WHERE client_id = _client_id;
  IF _enc IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(_enc, dp_private.get_key());
END $$;
GRANT EXECUTE ON FUNCTION public.get_timeclock_password(uuid) TO authenticated;

CREATE TABLE public.client_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  upload_type text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text DEFAULT '',
  version int NOT NULL DEFAULT 1,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id),
  notes text DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_uploads TO authenticated;
GRANT ALL ON public.client_uploads TO service_role;
ALTER TABLE public.client_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth uploads all" ON public.client_uploads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.client_diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  author_id uuid REFERENCES auth.users(id),
  author_name text DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  text text NOT NULL,
  attachment_path text DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  archived_reason text DEFAULT '',
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.client_diary_entries TO authenticated;
GRANT ALL ON public.client_diary_entries TO service_role;
ALTER TABLE public.client_diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth diary read" ON public.client_diary_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth diary ins" ON public.client_diary_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth diary upd" ON public.client_diary_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_diary_updated BEFORE UPDATE ON public.client_diary_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.client_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id),
  user_email text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.client_audit_log TO authenticated;
GRANT ALL ON public.client_audit_log TO service_role;
ALTER TABLE public.client_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth audit read" ON public.client_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth audit ins" ON public.client_audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.client_ccts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  union_base text DEFAULT '',
  sindicato text DEFAULT '',
  uf text DEFAULT '',
  data_base text DEFAULT '',
  validity_start date,
  validity_end date,
  doc_path text DEFAULT '',
  doc_name text DEFAULT '',
  ai_summary text DEFAULT '',
  ai_clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_ccts TO authenticated;
GRANT ALL ON public.client_ccts TO service_role;
ALTER TABLE public.client_ccts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth ccts all" ON public.client_ccts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.client_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'provento',
  percents_text text DEFAULT '',
  incidences jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_critical boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_rubrics TO authenticated;
GRANT ALL ON public.client_rubrics TO service_role;
ALTER TABLE public.client_rubrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth rubrics all" ON public.client_rubrics FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_rubrics_updated BEFORE UPDATE ON public.client_rubrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.closing_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closing_checklist_templates TO authenticated;
GRANT ALL ON public.closing_checklist_templates TO service_role;
ALTER TABLE public.closing_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth tmpl all" ON public.closing_checklist_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_tmpl_updated BEFORE UPDATE ON public.closing_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.closing_checklist_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  competence text NOT NULL,
  template_id uuid REFERENCES public.closing_checklist_templates(id) ON DELETE SET NULL,
  steps_status jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, competence)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closing_checklist_runs TO authenticated;
GRANT ALL ON public.closing_checklist_runs TO service_role;
ALTER TABLE public.closing_checklist_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth runs all" ON public.closing_checklist_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_runs_updated BEFORE UPDATE ON public.closing_checklist_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.client_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  is_global boolean NOT NULL DEFAULT false,
  category text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_message_templates TO authenticated;
GRANT ALL ON public.client_message_templates TO service_role;
ALTER TABLE public.client_message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth msg all" ON public.client_message_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_msg_updated BEFORE UPDATE ON public.client_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.client_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_calendar_events TO authenticated;
GRANT ALL ON public.client_calendar_events TO service_role;
ALTER TABLE public.client_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth cal all" ON public.client_calendar_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.client_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  severity text NOT NULL DEFAULT 'media',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_risk_flags TO authenticated;
GRANT ALL ON public.client_risk_flags TO service_role;
ALTER TABLE public.client_risk_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth risk all" ON public.client_risk_flags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_risk_updated BEFORE UPDATE ON public.client_risk_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.client_message_templates (is_global, category, channel, title, body) VALUES
(true, 'solicitar_ponto', 'whatsapp', 'Solicitar ponto/variáveis', 'Olá {{cliente_nome}}, tudo bem? Solicitamos o envio do ponto/variáveis da competência {{competencia}} até {{prazo}}. Qualquer dúvida estamos à disposição.'),
(true, 'cobrar_pendencia', 'whatsapp', 'Cobrar pendência', 'Olá {{cliente_nome}}, identificamos pendências para fechamento da folha {{competencia}}. Por favor, retorne até {{prazo}}. Responsável: {{responsavel}}.'),
(true, 'envio_previa', 'whatsapp', 'Envio da prévia', 'Olá {{cliente_nome}}, segue a prévia da folha {{competencia}}. Por favor, confirme ou solicite ajustes até {{prazo}}.'),
(true, 'confirmar_previa', 'whatsapp', 'Confirmar prévia', 'Olá {{cliente_nome}}, aguardamos sua confirmação da prévia da folha {{competencia}} para seguirmos com o fechamento.'),
(true, 'envio_final', 'whatsapp', 'Envio final da folha', 'Olá {{cliente_nome}}, segue a folha final da competência {{competencia}} com holerites e relatórios.'),
(true, 'pendencias_fechamento', 'email', 'Pendências para fechamento', 'Prezado(a) {{cliente_nome}},\n\nIdentificamos pendências para fechamento da folha {{competencia}}.\n\nPedimos retorno até {{prazo}}.\n\nAtenciosamente,\n{{responsavel}}');

INSERT INTO public.closing_checklist_templates (name, is_default, steps) VALUES
('Checklist Padrão DP', true, '[
  {"id":"1","title":"Receber ponto / variáveis"},
  {"id":"2","title":"Conferir jornada / banco de horas"},
  {"id":"3","title":"Lançar variáveis"},
  {"id":"4","title":"Conferir INSS / FGTS / IRRF"},
  {"id":"5","title":"Conferir eventos críticos (rubricas)"},
  {"id":"6","title":"Gerar prévia"},
  {"id":"7","title":"Ajustes pós-prévia"},
  {"id":"8","title":"Gerar holerites finais"},
  {"id":"9","title":"Enviar ao cliente + confirmação"},
  {"id":"10","title":"Arquivar comprovantes / relatórios"}
]'::jsonb);
