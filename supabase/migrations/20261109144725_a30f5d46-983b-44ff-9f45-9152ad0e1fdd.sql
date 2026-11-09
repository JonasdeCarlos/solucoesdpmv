CREATE TABLE public.pec_commercial_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL, email text NOT NULL, whatsapp text NOT NULL, empresa text NOT NULL DEFAULT '', etapa text NOT NULL DEFAULT 'novo', consentimento_em timestamptz NOT NULL DEFAULT now(), origem text NOT NULL DEFAULT 'pec-comercial', access_hash text NOT NULL UNIQUE, ip_hash text, workspace jsonb NOT NULL DEFAULT '{"parametros":null,"setores":[],"datas":[],"cenarios":[],"escala":null}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.pec_commercial_leads TO authenticated;
GRANT ALL ON public.pec_commercial_leads TO service_role;
ALTER TABLE public.pec_commercial_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY internal_leads_read ON public.pec_commercial_leads FOR SELECT TO authenticated USING (app_security.internal_user_authorized());
CREATE POLICY internal_leads_update ON public.pec_commercial_leads FOR UPDATE TO authenticated USING (app_security.internal_user_authorized()) WITH CHECK (app_security.internal_user_authorized());
CREATE POLICY internal_leads_delete ON public.pec_commercial_leads FOR DELETE TO authenticated USING (app_security.internal_user_authorized());
CREATE TRIGGER pec_commercial_leads_updated BEFORE UPDATE ON public.pec_commercial_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX pec_commercial_leads_created_idx ON public.pec_commercial_leads (created_at DESC);