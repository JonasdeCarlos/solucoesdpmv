
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_folha text;

CREATE TABLE IF NOT EXISTS public.dp_segmentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dp_segmentos TO authenticated;
GRANT ALL ON public.dp_segmentos TO service_role;

ALTER TABLE public.dp_segmentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read dp_segmentos" ON public.dp_segmentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage dp_segmentos" ON public.dp_segmentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.dp_segmentos (nome) VALUES
  ('Hotelaria'), ('Restaurante'), ('Serviço'), ('Comércio'), ('Doméstica'), ('Indústria'), ('Construção Civil'), ('Saúde'), ('Educação'), ('Transporte')
ON CONFLICT (nome) DO NOTHING;
