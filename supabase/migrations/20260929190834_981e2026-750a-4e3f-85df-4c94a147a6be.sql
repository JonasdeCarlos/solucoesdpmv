CREATE TABLE public.premiacao_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  politica_id uuid NOT NULL REFERENCES public.premiacao_politicas(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.premiacao_colaboradores(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  texto text NOT NULL DEFAULT '',
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (politica_id, colaborador_id, competencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.premiacao_feedbacks TO authenticated;
GRANT ALL ON public.premiacao_feedbacks TO service_role;

ALTER TABLE public.premiacao_feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON public.premiacao_feedbacks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER premiacao_feedbacks_updated_at
  BEFORE UPDATE ON public.premiacao_feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();