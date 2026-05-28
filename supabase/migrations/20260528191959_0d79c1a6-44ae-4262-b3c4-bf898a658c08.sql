
-- =========================================
-- OFFICE BRANDING
-- =========================================
CREATE TABLE public.office_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_name TEXT NOT NULL DEFAULT 'Monte Verde Contabilidade',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#628E3F',
  secondary_color TEXT NOT NULL DEFAULT '#E1E8F2',
  text_color TEXT NOT NULL DEFAULT '#393421',
  contacts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_branding TO authenticated;
GRANT ALL ON public.office_branding TO service_role;
ALTER TABLE public.office_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full office_branding" ON public.office_branding FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_office_branding_upd BEFORE UPDATE ON public.office_branding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- CCTs
-- =========================================
CREATE TABLE public.ccts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sindicato TEXT NOT NULL DEFAULT '',
  uf TEXT NOT NULL DEFAULT '',
  vigencia_inicio DATE,
  vigencia_fim DATE,
  observacoes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ccts TO authenticated;
GRANT ALL ON public.ccts TO service_role;
ALTER TABLE public.ccts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full ccts" ON public.ccts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ccts_upd BEFORE UPDATE ON public.ccts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- HOLIDAY SOURCE DOCUMENTS (decretos / CCTs PDF)
-- =========================================
CREATE TABLE public.holiday_source_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_type TEXT NOT NULL DEFAULT 'decreto_municipal', -- decreto_municipal|decreto_estadual|cct|outro
  uf TEXT,
  municipio TEXT,
  cct_id UUID,
  ano INTEGER,
  file_path TEXT,
  file_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente|processado|erro
  extraction_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_by TEXT NOT NULL DEFAULT '',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_extracted INTEGER NOT NULL DEFAULT 0,
  total_confirmed INTEGER NOT NULL DEFAULT 0,
  total_ignored INTEGER NOT NULL DEFAULT 0,
  total_duplicated INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_source_documents TO authenticated;
GRANT ALL ON public.holiday_source_documents TO service_role;
ALTER TABLE public.holiday_source_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full hsd" ON public.holiday_source_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================
-- HOLIDAYS
-- =========================================
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'municipal', -- distrital|municipal|estadual|sindical|ponto_facultativo|interno
  is_holiday BOOLEAN NOT NULL DEFAULT true,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  scope_type TEXT NOT NULL DEFAULT 'municipio', -- todos|uf|municipio|empresa|cct
  uf TEXT,
  municipio TEXT,
  company_id UUID,
  cct_id UUID,
  source_type TEXT NOT NULL DEFAULT 'manual', -- auto|manual|decreto|cct|import_csv
  source_doc_id UUID,
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo|inativo
  observacoes TEXT NOT NULL DEFAULT '',
  vigencia_inicio DATE,
  vigencia_fim DATE,
  dedupe_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_holidays_data ON public.holidays(data);
CREATE INDEX idx_holidays_scope ON public.holidays(scope_type, uf, municipio);
CREATE INDEX idx_holidays_dedupe ON public.holidays(dedupe_key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full holidays" ON public.holidays FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_holidays_upd BEFORE UPDATE ON public.holidays FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- HOLIDAY EXTRACTION ITEMS (pendentes de revisão)
-- =========================================
CREATE TABLE public.holiday_extraction_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_doc_id UUID NOT NULL,
  data DATE,
  nome TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'municipal',
  is_holiday BOOLEAN NOT NULL DEFAULT true,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  scope_type TEXT NOT NULL DEFAULT 'municipio',
  uf TEXT,
  municipio TEXT,
  cct_id UUID,
  confidence NUMERIC NOT NULL DEFAULT 0,
  evidence_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente|confirmado|ignorado|duplicado
  holiday_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hei_source ON public.holiday_extraction_items(source_doc_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_extraction_items TO authenticated;
GRANT ALL ON public.holiday_extraction_items TO service_role;
ALTER TABLE public.holiday_extraction_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full hei" ON public.holiday_extraction_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================
-- HOLIDAY NOTICES
-- =========================================
CREATE TABLE public.holiday_notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body_template TEXT NOT NULL DEFAULT '',
  holiday_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  audience JSONB NOT NULL DEFAULT '{"type":"todos"}'::jsonb,
  -- audience: { type: 'todos'|'uf'|'municipio'|'cct'|'empresa', uf?, municipio?, cct_id?, company_id? }
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho|publicado|arquivado
  periodo_inicio DATE,
  periodo_fim DATE,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_notices TO authenticated;
GRANT ALL ON public.holiday_notices TO service_role;
ALTER TABLE public.holiday_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full notices" ON public.holiday_notices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_notices_upd BEFORE UPDATE ON public.holiday_notices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- HOLIDAY NOTICE EXPORTS
-- =========================================
CREATE TABLE public.holiday_notice_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id UUID NOT NULL,
  pdf_path TEXT,
  whatsapp_text TEXT NOT NULL DEFAULT '',
  exported_by TEXT NOT NULL DEFAULT '',
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_notice_exports TO authenticated;
GRANT ALL ON public.holiday_notice_exports TO service_role;
ALTER TABLE public.holiday_notice_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full notice_exports" ON public.holiday_notice_exports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================
-- AUDIT LOG
-- =========================================
CREATE TABLE public.holiday_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  user_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_audit_log TO authenticated;
GRANT ALL ON public.holiday_audit_log TO service_role;
ALTER TABLE public.holiday_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full audit" ON public.holiday_audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================
-- STORAGE BUCKETS
-- =========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('feriados-docs','feriados-docs', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('office-assets','office-assets', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth read feriados-docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'feriados-docs');
CREATE POLICY "auth write feriados-docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'feriados-docs');
CREATE POLICY "auth update feriados-docs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'feriados-docs');
CREATE POLICY "auth delete feriados-docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'feriados-docs');

CREATE POLICY "public read office-assets" ON storage.objects FOR SELECT USING (bucket_id = 'office-assets');
CREATE POLICY "auth write office-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'office-assets');
CREATE POLICY "auth update office-assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'office-assets');
CREATE POLICY "auth delete office-assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'office-assets');

-- Seed branding line if none exists
INSERT INTO public.office_branding (office_name, primary_color, secondary_color, text_color, contacts)
SELECT 'Monte Verde Contabilidade', '#628E3F', '#E1E8F2', '#393421', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.office_branding);
