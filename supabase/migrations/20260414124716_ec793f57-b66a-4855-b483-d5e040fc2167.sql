
CREATE TABLE public.banco_horas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empregado_nome TEXT NOT NULL,
  empresa_nome TEXT NOT NULL DEFAULT '',
  mes_ano TEXT NOT NULL,
  saldo_final INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empregado_nome, empresa_nome, mes_ano)
);

ALTER TABLE public.banco_horas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to banco_horas"
  ON public.banco_horas
  FOR ALL
  USING (true)
  WITH CHECK (true);
