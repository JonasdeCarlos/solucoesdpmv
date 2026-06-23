
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS public_feedback_token text UNIQUE;
UPDATE public.clientes SET public_feedback_token = encode(gen_random_bytes(16),'hex') WHERE public_feedback_token IS NULL;

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  model text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  credits_estimate numeric(12,6) NOT NULL DEFAULT 0,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_usage_log read auth" ON public.ai_usage_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_usage_log insert auth" ON public.ai_usage_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS ai_usage_log_client_idx ON public.ai_usage_log(client_id, created_at DESC);
