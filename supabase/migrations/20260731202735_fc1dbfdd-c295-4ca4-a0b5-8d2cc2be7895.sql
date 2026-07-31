CREATE TABLE public.cct_radar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emails text[] NOT NULL DEFAULT '{}',
  alert_days_before integer NOT NULL DEFAULT 60,
  auto_search_enabled boolean NOT NULL DEFAULT true,
  search_frequency_days integer NOT NULL DEFAULT 7,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cct_radar_settings TO authenticated;
GRANT ALL ON public.cct_radar_settings TO service_role;
ALTER TABLE public.cct_radar_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage radar settings" ON public.cct_radar_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cct_radar_settings_updated BEFORE UPDATE ON public.cct_radar_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cct_radar_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_cct_id uuid REFERENCES public.client_ccts(id) ON DELETE CASCADE,
  cct_analysis_id uuid REFERENCES public.cct_analyses(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  finding_type text NOT NULL DEFAULT 'nova_cct',
  source_type text NOT NULL DEFAULT 'nao_oficial',
  source_name text,
  source_url text,
  title text,
  numero_registro_mte text,
  vigencia_inicio date,
  vigencia_fim date,
  cnpjs jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric,
  ai_notes text,
  status text NOT NULL DEFAULT 'pendente',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cct_radar_findings TO authenticated;
GRANT ALL ON public.cct_radar_findings TO service_role;
ALTER TABLE public.cct_radar_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read radar findings" ON public.cct_radar_findings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write radar findings" ON public.cct_radar_findings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update radar findings" ON public.cct_radar_findings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin delete radar findings" ON public.cct_radar_findings FOR DELETE TO authenticated USING (public.is_admin_or_master(auth.uid()));
CREATE TRIGGER trg_cct_radar_findings_updated BEFORE UPDATE ON public.cct_radar_findings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_cct_radar_findings_status ON public.cct_radar_findings(status);
CREATE INDEX idx_cct_radar_findings_cct ON public.cct_radar_findings(client_cct_id);