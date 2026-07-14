
CREATE TABLE public.cct_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_cct_id UUID REFERENCES public.client_ccts(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  original_file_path TEXT,
  original_file_name TEXT,
  ocr_text TEXT,
  ocr_applied BOOLEAN NOT NULL DEFAULT false,
  ai_model TEXT,
  ai_version TEXT,
  confidence_score NUMERIC(4,2),
  status TEXT NOT NULL DEFAULT 'em_analise',
  identification JSONB NOT NULL DEFAULT '{}'::jsonb,
  unions JSONB NOT NULL DEFAULT '{}'::jsonb,
  territorial_base JSONB NOT NULL DEFAULT '{}'::jsonb,
  professional_classes JSONB NOT NULL DEFAULT '{}'::jsonb,
  economic_clauses JSONB NOT NULL DEFAULT '{}'::jsonb,
  benefits_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  journey_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  overtime_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  vacation_absence JSONB NOT NULL DEFAULT '{}'::jsonb,
  admission_termination JSONB NOT NULL DEFAULT '{}'::jsonb,
  union_obligations JSONB NOT NULL DEFAULT '{}'::jsonb,
  health_safety JSONB NOT NULL DEFAULT '{}'::jsonb,
  penalties JSONB NOT NULL DEFAULT '{}'::jsonb,
  dp_attention_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  reviewer_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cct_analyses TO authenticated;
GRANT ALL ON public.cct_analyses TO service_role;
ALTER TABLE public.cct_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cct_analyses read auth" ON public.cct_analyses FOR SELECT TO authenticated USING (true);
CREATE POLICY "cct_analyses insert auth" ON public.cct_analyses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cct_analyses update auth" ON public.cct_analyses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cct_analyses delete admin" ON public.cct_analyses FOR DELETE TO authenticated USING (public.is_admin_or_master(auth.uid()));
CREATE INDEX idx_cct_analyses_client_cct ON public.cct_analyses(client_cct_id);
CREATE INDEX idx_cct_analyses_status ON public.cct_analyses(status);

ALTER TABLE public.client_ccts ADD COLUMN IF NOT EXISTS cct_analysis_id UUID REFERENCES public.cct_analyses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_client_ccts_analysis ON public.client_ccts(cct_analysis_id);

CREATE TABLE public.cct_clauses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cct_analysis_id UUID NOT NULL REFERENCES public.cct_analyses(id) ON DELETE CASCADE,
  clause_title TEXT NOT NULL,
  clause_type TEXT,
  extracted_text TEXT,
  summary TEXT,
  source_snippet TEXT,
  page_number INT,
  confidence TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cct_clauses TO authenticated;
GRANT ALL ON public.cct_clauses TO service_role;
ALTER TABLE public.cct_clauses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cct_clauses all auth" ON public.cct_clauses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cct_clauses_analysis ON public.cct_clauses(cct_analysis_id);

CREATE TABLE public.cct_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cct_analysis_id UUID NOT NULL REFERENCES public.cct_analyses(id) ON DELETE CASCADE,
  benefit_name TEXT NOT NULL,
  value_text TEXT,
  value_amount NUMERIC(14,2),
  periodicity TEXT,
  eligible_employees TEXT,
  conditions TEXT,
  employee_discount_allowed BOOLEAN,
  due_date_rule TEXT,
  penalty TEXT,
  notes TEXT,
  source_snippet TEXT,
  page_number INT,
  confidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cct_benefits TO authenticated;
GRANT ALL ON public.cct_benefits TO service_role;
ALTER TABLE public.cct_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cct_benefits all auth" ON public.cct_benefits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cct_benefits_analysis ON public.cct_benefits(cct_analysis_id);

CREATE TABLE public.cct_client_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cct_analysis_id UUID NOT NULL REFERENCES public.cct_analyses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  client_cct_id UUID REFERENCES public.client_ccts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  linked_by UUID,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlinked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cct_analysis_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cct_client_links TO authenticated;
GRANT ALL ON public.cct_client_links TO service_role;
ALTER TABLE public.cct_client_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cct_client_links all auth" ON public.cct_client_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cct_client_links_analysis ON public.cct_client_links(cct_analysis_id);
CREATE INDEX idx_cct_client_links_client ON public.cct_client_links(client_id);

CREATE TABLE public.cct_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cct_analysis_id UUID REFERENCES public.cct_analyses(id) ON DELETE CASCADE,
  client_cct_id UUID REFERENCES public.client_ccts(id) ON DELETE CASCADE,
  client_id UUID,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'media',
  due_date DATE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cct_alerts TO authenticated;
GRANT ALL ON public.cct_alerts TO service_role;
ALTER TABLE public.cct_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cct_alerts all auth" ON public.cct_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cct_alerts_status ON public.cct_alerts(status);
CREATE INDEX idx_cct_alerts_analysis ON public.cct_alerts(cct_analysis_id);

CREATE TABLE public.cct_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cct_analysis_id UUID NOT NULL REFERENCES public.cct_analyses(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  pdf_path TEXT,
  whatsapp_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cct_reports TO authenticated;
GRANT ALL ON public.cct_reports TO service_role;
ALTER TABLE public.cct_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cct_reports all auth" ON public.cct_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cct_reports_analysis ON public.cct_reports(cct_analysis_id);

CREATE TABLE public.cct_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cct_analysis_id UUID REFERENCES public.cct_analyses(id) ON DELETE SET NULL,
  client_id UUID,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cct_audit_log TO authenticated;
GRANT ALL ON public.cct_audit_log TO service_role;
ALTER TABLE public.cct_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cct_audit_log read auth" ON public.cct_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "cct_audit_log insert auth" ON public.cct_audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_cct_audit_analysis ON public.cct_audit_log(cct_analysis_id);

CREATE TABLE public.cct_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cct_analysis_id UUID NOT NULL REFERENCES public.cct_analyses(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  ocr_text_snapshot TEXT,
  file_path_snapshot TEXT,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cct_versions TO authenticated;
GRANT ALL ON public.cct_versions TO service_role;
ALTER TABLE public.cct_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cct_versions read auth" ON public.cct_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "cct_versions insert auth" ON public.cct_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_cct_versions_analysis ON public.cct_versions(cct_analysis_id);

CREATE TRIGGER trg_cct_analyses_updated BEFORE UPDATE ON public.cct_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cct_clauses_updated BEFORE UPDATE ON public.cct_clauses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cct_benefits_updated BEFORE UPDATE ON public.cct_benefits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cct_client_links_updated BEFORE UPDATE ON public.cct_client_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cct_alerts_updated BEFORE UPDATE ON public.cct_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cct_reports_updated BEFORE UPDATE ON public.cct_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
