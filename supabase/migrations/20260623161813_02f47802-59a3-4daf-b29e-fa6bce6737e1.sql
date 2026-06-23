
CREATE TABLE public.feedback_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('feedback','cobranca','alinhamento')),
  employee_name text NOT NULL,
  employee_role text,
  manager_name text,
  pontos_fortes text,
  pontos_melhorar text,
  fato_ocorrido text,
  tom text CHECK (tom IS NULL OR tom IN ('leve','medio','cobranca')),
  generated_text text,
  public_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  view_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  signed_at timestamptz,
  signed_by text,
  signature_data text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_records_client ON public.feedback_records(client_id);
CREATE INDEX idx_feedback_records_token ON public.feedback_records(public_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_records TO authenticated;
GRANT ALL ON public.feedback_records TO service_role;

ALTER TABLE public.feedback_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage feedback_records"
  ON public.feedback_records FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_feedback_records_updated
  BEFORE UPDATE ON public.feedback_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
