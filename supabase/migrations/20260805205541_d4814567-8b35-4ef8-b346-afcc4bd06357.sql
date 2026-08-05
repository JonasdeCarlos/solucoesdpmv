CREATE TABLE IF NOT EXISTS public.admissao_notify_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  whatsapp_numeros text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admissao_notify_settings TO authenticated;
GRANT SELECT ON public.admissao_notify_settings TO anon;
GRANT ALL ON public.admissao_notify_settings TO service_role;

ALTER TABLE public.admissao_notify_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admissao_notify_settings_all" ON public.admissao_notify_settings;
CREATE POLICY "admissao_notify_settings_all" ON public.admissao_notify_settings
  FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_admissao_notify_settings_updated ON public.admissao_notify_settings;
CREATE TRIGGER trg_admissao_notify_settings_updated
  BEFORE UPDATE ON public.admissao_notify_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.admissao_notify_settings (enabled, whatsapp_numeros)
SELECT true, '{}'
WHERE NOT EXISTS (SELECT 1 FROM public.admissao_notify_settings);