
-- 1) Estender tabela verbas
ALTER TABLE public.verbas 
  ADD COLUMN IF NOT EXISTS codigo text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo_lancamento text NOT NULL DEFAULT 'valor_fixo',
  ADD COLUMN IF NOT EXISTS incide_dsr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regra_dsr text NOT NULL DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS regra_dsr_custom text,
  ADD COLUMN IF NOT EXISTS considera_domingo_dsr boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS considera_feriado_dsr boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS observacoes text DEFAULT '';

-- 2) Estender feriados_municipais
ALTER TABLE public.feriados_municipais
  ADD COLUMN IF NOT EXISTS municipio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf text DEFAULT '',
  ADD COLUMN IF NOT EXISTS conta_dia_nao_util boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS conta_dsr boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'municipal';

-- 3) Overrides de feriados nacionais (ex: marcar como ponto facultativo)
CREATE TABLE IF NOT EXISTS public.feriados_nacionais_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ano integer NOT NULL,
  chave text NOT NULL,
  ponto_facultativo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(ano, chave)
);

ALTER TABLE public.feriados_nacionais_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to feriados_nacionais_overrides"
ON public.feriados_nacionais_overrides FOR ALL
USING (true) WITH CHECK (true);

-- 4) Lançamentos de provisões
CREATE TABLE IF NOT EXISTS public.provision_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_nome text NOT NULL DEFAULT '',
  competencia text NOT NULL,
  centro_custo text DEFAULT '',
  colaborador text DEFAULT '',
  verba_id uuid REFERENCES public.verbas(id) ON DELETE RESTRICT,
  tipo_lancamento text NOT NULL DEFAULT 'valor_fixo',
  valor numeric NOT NULL DEFAULT 0,
  quantidade numeric DEFAULT 0,
  valor_unitario numeric DEFAULT 0,
  observacao text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.provision_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to provision_entries"
ON public.provision_entries FOR ALL
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_provision_entries_competencia 
  ON public.provision_entries(empresa_nome, competencia);

-- 5) Resultados mensais de apuração DSR
CREATE TABLE IF NOT EXISTS public.dsr_monthly_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_nome text NOT NULL DEFAULT '',
  competencia text NOT NULL,
  dias_uteis integer NOT NULL DEFAULT 0,
  dias_dsr integer NOT NULL DEFAULT 0,
  domingos integer NOT NULL DEFAULT 0,
  feriados_nao_uteis integer NOT NULL DEFAULT 0,
  detalhe_verbas jsonb DEFAULT '[]'::jsonb,
  total_base numeric NOT NULL DEFAULT 0,
  total_dsr numeric NOT NULL DEFAULT 0,
  gerado_em timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(empresa_nome, competencia)
);

ALTER TABLE public.dsr_monthly_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to dsr_monthly_results"
ON public.dsr_monthly_results FOR ALL
USING (true) WITH CHECK (true);

-- 6) Trigger updated_at em provision_entries
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_provision_entries_updated_at ON public.provision_entries;
CREATE TRIGGER update_provision_entries_updated_at
BEFORE UPDATE ON public.provision_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
