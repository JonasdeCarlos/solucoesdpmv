
-- Empresas detectadas pelos PDFs
CREATE TABLE public.aviso_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL DEFAULT '',
  cnpj text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, cnpj)
);
ALTER TABLE public.aviso_empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to aviso_empresas" ON public.aviso_empresas FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_aviso_empresas_updated BEFORE UPDATE ON public.aviso_empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico de importações
CREATE TABLE public.aviso_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL DEFAULT '',
  file_path text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  emission_date date,
  emission_time text,
  total_empresas integer NOT NULL DEFAULT 0,
  total_rows integer NOT NULL DEFAULT 0,
  novos integer NOT NULL DEFAULT 0,
  ignorados integer NOT NULL DEFAULT 0,
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_by text NOT NULL DEFAULT ''
);
ALTER TABLE public.aviso_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to aviso_imports" ON public.aviso_imports FOR ALL USING (true) WITH CHECK (true);

-- Avisos (tickets)
CREATE TABLE public.avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.aviso_empresas(id) ON DELETE SET NULL,
  empresa_code text NOT NULL DEFAULT '',
  empresa_name text NOT NULL DEFAULT '',
  empresa_cnpj text NOT NULL DEFAULT '',
  employee_code text NOT NULL DEFAULT '',
  employee_name text NOT NULL DEFAULT '',
  motivo text NOT NULL DEFAULT 'Outros',
  motivo_original text NOT NULL DEFAULT '',
  due_date date,
  limit_date date,
  source_emission_date date,
  import_id uuid REFERENCES public.aviso_imports(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberto', -- sem_retorno | aberto | em_tratamento | concluido
  unique_hash text NOT NULL UNIQUE,
  aviso1_at timestamptz, aviso1_by text,
  aviso2_at timestamptz, aviso2_by text,
  aviso3_at timestamptz, aviso3_by text,
  no_response_at timestamptz, no_response_by text,
  observacoes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to avisos" ON public.avisos FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_avisos_updated BEFORE UPDATE ON public.avisos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_avisos_status ON public.avisos(status);
CREATE INDEX idx_avisos_empresa ON public.avisos(empresa_id);
CREATE INDEX idx_avisos_due ON public.avisos(due_date);

-- Histórico de marcações / contatos
CREATE TABLE public.aviso_contact_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aviso_id uuid NOT NULL REFERENCES public.avisos(id) ON DELETE CASCADE,
  attempt_type text NOT NULL, -- aviso1 | aviso2 | aviso3 | no_response | call | status_change | observation
  marked_at timestamptz NOT NULL DEFAULT now(),
  marked_by text NOT NULL DEFAULT '',
  call_date date,
  call_channel text,
  notes text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.aviso_contact_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to aviso_contact_attempts" ON public.aviso_contact_attempts FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_aviso_attempts_aviso ON public.aviso_contact_attempts(aviso_id);

-- Bucket privado dos PDFs originais
INSERT INTO storage.buckets (id, name, public) VALUES ('aviso-pdfs', 'aviso-pdfs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read aviso-pdfs" ON storage.objects FOR SELECT USING (bucket_id = 'aviso-pdfs');
CREATE POLICY "Public insert aviso-pdfs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'aviso-pdfs');
CREATE POLICY "Public update aviso-pdfs" ON storage.objects FOR UPDATE USING (bucket_id = 'aviso-pdfs');
CREATE POLICY "Public delete aviso-pdfs" ON storage.objects FOR DELETE USING (bucket_id = 'aviso-pdfs');
