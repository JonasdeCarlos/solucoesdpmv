CREATE TABLE public.empregados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL DEFAULT '',
  funcao TEXT NOT NULL DEFAULT '',
  empresa_nome TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(nome, empresa_nome)
);

ALTER TABLE public.empregados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to empregados"
ON public.empregados
FOR ALL
USING (true)
WITH CHECK (true);