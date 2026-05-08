
-- Templates de formulário
CREATE TABLE public.admission_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Novo formulário',
  description TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  schema_json JSONB NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admission_form_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to admission_form_templates"
  ON public.admission_form_templates FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER admission_form_templates_updated_at
  BEFORE UPDATE ON public.admission_form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Solicitações de admissão
CREATE TABLE public.admission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.admission_form_templates(id) ON DELETE SET NULL,
  template_name_snapshot TEXT NOT NULL DEFAULT '',
  template_schema_snapshot JSONB NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  company_name TEXT NOT NULL DEFAULT '',
  company_cnpj TEXT NOT NULL DEFAULT '',
  employee_name TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'rascunho',
  draft_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admission_requests_token ON public.admission_requests(token);
CREATE INDEX idx_admission_requests_status ON public.admission_requests(status);

ALTER TABLE public.admission_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to admission_requests"
  ON public.admission_requests FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER admission_requests_updated_at
  BEFORE UPDATE ON public.admission_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Arquivos enviados
CREATE TABLE public.admission_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.admission_requests(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admission_files_request ON public.admission_files(request_id);

ALTER TABLE public.admission_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to admission_files"
  ON public.admission_files FOR ALL USING (true) WITH CHECK (true);

-- Dossiês gerados
CREATE TABLE public.admission_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.admission_requests(id) ON DELETE CASCADE,
  pdf_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admission_dossiers_request ON public.admission_dossiers(request_id);

ALTER TABLE public.admission_dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to admission_dossiers"
  ON public.admission_dossiers FOR ALL USING (true) WITH CHECK (true);

-- Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('admissao-uploads', 'admissao-uploads', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('admissao-dossies', 'admissao-dossies', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow all read admissao-uploads"
  ON storage.objects FOR SELECT USING (bucket_id = 'admissao-uploads');
CREATE POLICY "Allow all insert admissao-uploads"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'admissao-uploads');
CREATE POLICY "Allow all update admissao-uploads"
  ON storage.objects FOR UPDATE USING (bucket_id = 'admissao-uploads');
CREATE POLICY "Allow all delete admissao-uploads"
  ON storage.objects FOR DELETE USING (bucket_id = 'admissao-uploads');

CREATE POLICY "Allow all read admissao-dossies"
  ON storage.objects FOR SELECT USING (bucket_id = 'admissao-dossies');
CREATE POLICY "Allow all insert admissao-dossies"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'admissao-dossies');
CREATE POLICY "Allow all update admissao-dossies"
  ON storage.objects FOR UPDATE USING (bucket_id = 'admissao-dossies');
CREATE POLICY "Allow all delete admissao-dossies"
  ON storage.objects FOR DELETE USING (bucket_id = 'admissao-dossies');
