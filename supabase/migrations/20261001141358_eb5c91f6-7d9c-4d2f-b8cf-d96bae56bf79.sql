ALTER TABLE public.fb_config_rubricas ADD COLUMN IF NOT EXISTS quinquenio_integra boolean NOT NULL DEFAULT true;
UPDATE public.fb_config_rubricas SET quinquenio_integra = false WHERE verba = 'AD_NOT';