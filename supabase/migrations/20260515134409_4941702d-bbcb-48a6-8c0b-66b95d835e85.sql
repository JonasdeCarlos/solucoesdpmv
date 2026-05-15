
-- BH Imports
CREATE TABLE public.bh_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_nome text NOT NULL DEFAULT '',
  empresa_cnpj text NOT NULL DEFAULT '',
  competencia date,
  file_path text,
  file_name text NOT NULL DEFAULT '',
  file_hash text,
  imported_by text NOT NULL DEFAULT '',
  total_paginas int NOT NULL DEFAULT 0,
  total_ok int NOT NULL DEFAULT 0,
  total_pendentes int NOT NULL DEFAULT 0,
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bh_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access bh_imports" ON public.bh_imports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- BH Employees
CREATE TABLE public.bh_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_cnpj text NOT NULL DEFAULT '',
  empresa_nome text NOT NULL DEFAULT '',
  codigo text NOT NULL DEFAULT '',
  nome text NOT NULL,
  daily_minutes_override int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_cnpj, codigo, nome)
);
ALTER TABLE public.bh_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access bh_employees" ON public.bh_employees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_bh_employees_updated_at BEFORE UPDATE ON public.bh_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BH Balances
CREATE TABLE public.bh_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.bh_imports(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.bh_employees(id) ON DELETE CASCADE,
  empresa_cnpj text NOT NULL DEFAULT '',
  competencia date NOT NULL,
  balance_minutes int NOT NULL DEFAULT 0,
  balance_hhmm text NOT NULL DEFAULT '00:00',
  status text NOT NULL DEFAULT 'ok',
  version int NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bh_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access bh_balances" ON public.bh_balances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_bh_balances_emp_comp ON public.bh_balances(employee_id, competencia);
CREATE INDEX idx_bh_balances_cnpj_comp ON public.bh_balances(empresa_cnpj, competencia);

-- BH Settings (global / empresa / colaborador)
CREATE TABLE public.bh_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global',
  empresa_cnpj text,
  employee_id uuid REFERENCES public.bh_employees(id) ON DELETE CASCADE,
  daily_minutes int NOT NULL DEFAULT 480,
  trend_threshold_minutes int NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bh_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access bh_settings" ON public.bh_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_bh_settings_updated_at BEFORE UPDATE ON public.bh_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.bh_settings(scope, daily_minutes, trend_threshold_minutes) VALUES('global', 480, 60);

-- Bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('ponto-pdfs', 'ponto-pdfs', false)
  ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Authenticated read ponto-pdfs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'ponto-pdfs');
CREATE POLICY "Authenticated write ponto-pdfs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ponto-pdfs');
CREATE POLICY "Authenticated update ponto-pdfs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'ponto-pdfs');
CREATE POLICY "Authenticated delete ponto-pdfs" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'ponto-pdfs');
