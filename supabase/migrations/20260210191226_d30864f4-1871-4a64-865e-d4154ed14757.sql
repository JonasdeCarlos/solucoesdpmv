
-- Tabela de Clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'PF' CHECK (tipo IN ('PF', 'PJ')),
  cpf TEXT DEFAULT '',
  cnpj TEXT DEFAULT '',
  endereco TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Acesso público por enquanto (sem autenticação)
CREATE POLICY "Allow all access to clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

-- Tabela de Verbas
CREATE TABLE public.verbas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo_calculo TEXT NOT NULL DEFAULT 'manual',
  referencia_padrao TEXT DEFAULT '',
  padrao_pd TEXT NOT NULL DEFAULT 'P' CHECK (padrao_pd IN ('P', 'D')),
  incide_fgts BOOLEAN NOT NULL DEFAULT true,
  calcula_dsr BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.verbas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to verbas" ON public.verbas FOR ALL USING (true) WITH CHECK (true);

-- Tabela de Feriados Municipais
CREATE TABLE public.feriados_municipais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feriados_municipais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to feriados" ON public.feriados_municipais FOR ALL USING (true) WITH CHECK (true);
