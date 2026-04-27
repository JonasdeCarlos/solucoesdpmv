CREATE TABLE IF NOT EXISTS public.vacation_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  company_name text NOT NULL DEFAULT '',
  company_doc text NOT NULL DEFAULT '',
  employee_name text NOT NULL,
  employee_cpf text NOT NULL,
  role text DEFAULT '',
  registration text DEFAULT '',
  pis text DEFAULT '',
  department text DEFAULT '',
  acquisition_start date NOT NULL,
  acquisition_end date NOT NULL,
  concession_start date NOT NULL,
  concession_end date NOT NULL,
  leave_start date NOT NULL,
  leave_end date NOT NULL,
  vacation_days integer NOT NULL DEFAULT 30,
  return_date date NOT NULL,
  vacation_type text NOT NULL DEFAULT 'Integrais',
  fraction_description text DEFAULT '',
  salary_base numeric NOT NULL DEFAULT 0,
  avg_variables numeric NOT NULL DEFAULT 0,
  other_pay_items numeric NOT NULL DEFAULT 0,
  base_remuneration numeric NOT NULL DEFAULT 0,
  vacation_value numeric NOT NULL DEFAULT 0,
  one_third_value numeric NOT NULL DEFAULT 0,
  abono_enabled boolean NOT NULL DEFAULT false,
  abono_days integer NOT NULL DEFAULT 0,
  abono_value numeric NOT NULL DEFAULT 0,
  abono_one_third_value numeric NOT NULL DEFAULT 0,
  discounts_value numeric NOT NULL DEFAULT 0,
  discounts_desc text DEFAULT '',
  gross_total numeric NOT NULL DEFAULT 0,
  net_total numeric NOT NULL DEFAULT 0,
  pay_method text NOT NULL DEFAULT 'Depósito',
  pay_date date NOT NULL,
  signature_place text NOT NULL DEFAULT 'Monte Verde',
  signature_date date NOT NULL DEFAULT CURRENT_DATE,
  responsible_name text DEFAULT '',
  responsible_cpf text DEFAULT '',
  responsible_role text DEFAULT '',
  created_by text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vacation_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to vacation_calculations"
ON public.vacation_calculations
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vacation_calculations_company ON public.vacation_calculations(company_name);
CREATE INDEX IF NOT EXISTS idx_vacation_calculations_employee ON public.vacation_calculations(employee_name);
CREATE INDEX IF NOT EXISTS idx_vacation_calculations_leave_start ON public.vacation_calculations(leave_start);

CREATE TRIGGER update_vacation_calculations_updated_at
BEFORE UPDATE ON public.vacation_calculations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.vacation_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id uuid NOT NULL,
  template_version text NOT NULL DEFAULT 'recibo-ferias-v1',
  pdf_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vacation_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to vacation_receipts"
ON public.vacation_receipts
FOR ALL
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vacation_receipts_calculation ON public.vacation_receipts(calculation_id);