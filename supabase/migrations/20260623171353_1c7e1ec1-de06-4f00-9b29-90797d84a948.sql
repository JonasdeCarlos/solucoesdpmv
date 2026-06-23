
ALTER TABLE public.client_dp_profile
  ADD COLUMN IF NOT EXISTS procuracao_empregador_web boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS empregador_web_user text,
  ADD COLUMN IF NOT EXISTS empregador_web_url text,
  ADD COLUMN IF NOT EXISTS empregador_web_password_encrypted bytea;

CREATE OR REPLACE FUNCTION public.set_empregador_web_password(_client_id uuid, _password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'dp_private'
AS $function$
BEGIN
  IF NOT public.is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE public.client_dp_profile
    SET empregador_web_password_encrypted = CASE
      WHEN _password IS NULL OR _password = '' THEN NULL
      ELSE pgp_sym_encrypt(_password, dp_private.get_key())
    END
    WHERE client_id = _client_id;
END $function$;

CREATE OR REPLACE FUNCTION public.get_empregador_web_password(_client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'dp_private'
AS $function$
DECLARE _enc bytea;
BEGIN
  IF NOT public.is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT empregador_web_password_encrypted INTO _enc FROM public.client_dp_profile WHERE client_id = _client_id;
  IF _enc IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(_enc, dp_private.get_key());
END $function$;
