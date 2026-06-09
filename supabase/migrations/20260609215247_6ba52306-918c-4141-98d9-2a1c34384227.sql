ALTER TABLE public.avisos_envios_log
  ADD COLUMN IF NOT EXISTS ticket_id text NULL,
  ADD COLUMN IF NOT EXISTS transfer_ok boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_endpoint text NULL,
  ADD COLUMN IF NOT EXISTS transfer_response jsonb NULL;