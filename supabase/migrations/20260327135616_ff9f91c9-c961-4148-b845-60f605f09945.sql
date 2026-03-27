
-- Dossier de rescisão
CREATE TABLE public.rescisao_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name text NOT NULL,
  termination_date date NOT NULL,
  payment_date_suggested date,
  payment_date_final date,
  competence_month text,
  company_name text,
  company_cnpj text,
  checked_by text,
  final_pdf_url text,
  status text NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rescisao_dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to rescisao_dossiers" ON public.rescisao_dossiers FOR ALL TO public USING (true) WITH CHECK (true);

-- Arquivos do dossiê
CREATE TABLE public.rescisao_dossier_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.rescisao_dossiers(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  doc_category text NOT NULL DEFAULT 'Outros',
  sort_order integer NOT NULL DEFAULT 0,
  pages integer DEFAULT 1,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rescisao_dossier_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to rescisao_dossier_files" ON public.rescisao_dossier_files FOR ALL TO public USING (true) WITH CHECK (true);

-- Template de capa
CREATE TABLE public.rescisao_cover_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Padrão',
  template_pdf_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rescisao_cover_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to rescisao_cover_templates" ON public.rescisao_cover_templates FOR ALL TO public USING (true) WITH CHECK (true);

-- Storage bucket para arquivos de rescisão
INSERT INTO storage.buckets (id, name, public) VALUES ('rescisao-docs', 'rescisao-docs', false);

CREATE POLICY "Allow all uploads to rescisao-docs" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'rescisao-docs');
CREATE POLICY "Allow all reads from rescisao-docs" ON storage.objects FOR SELECT TO public USING (bucket_id = 'rescisao-docs');
CREATE POLICY "Allow all deletes from rescisao-docs" ON storage.objects FOR DELETE TO public USING (bucket_id = 'rescisao-docs');
