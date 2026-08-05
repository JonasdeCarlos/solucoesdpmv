
CREATE OR REPLACE FUNCTION public.set_timeclock_password(_client_id uuid, _password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'dp_private', 'extensions'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  INSERT INTO public.client_dp_profile (client_id) VALUES (_client_id)
    ON CONFLICT (client_id) DO NOTHING;
  UPDATE public.client_dp_profile
    SET timeclock_password_encrypted = CASE
      WHEN _password IS NULL OR _password = '' THEN NULL
      ELSE extensions.pgp_sym_encrypt(_password, dp_private.get_key())
    END
    WHERE client_id = _client_id;
END $function$;

CREATE OR REPLACE FUNCTION public.get_timeclock_password(_client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'dp_private', 'extensions'
AS $function$
DECLARE _enc bytea;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT timeclock_password_encrypted INTO _enc FROM public.client_dp_profile WHERE client_id = _client_id;
  IF _enc IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_decrypt(_enc, dp_private.get_key());
END $function$;

CREATE OR REPLACE FUNCTION public.set_empregador_web_password(_client_id uuid, _password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'dp_private', 'extensions'
AS $function$
BEGIN
  IF NOT public.is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  INSERT INTO public.client_dp_profile (client_id) VALUES (_client_id)
    ON CONFLICT (client_id) DO NOTHING;
  UPDATE public.client_dp_profile
    SET empregador_web_password_encrypted = CASE
      WHEN _password IS NULL OR _password = '' THEN NULL
      ELSE extensions.pgp_sym_encrypt(_password, dp_private.get_key())
    END
    WHERE client_id = _client_id;
END $function$;

CREATE OR REPLACE FUNCTION public.get_empregador_web_password(_client_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'dp_private', 'extensions'
AS $function$
DECLARE _enc bytea;
BEGIN
  IF NOT public.is_admin_or_master(auth.uid()) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT empregador_web_password_encrypted INTO _enc FROM public.client_dp_profile WHERE client_id = _client_id;
  IF _enc IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_decrypt(_enc, dp_private.get_key());
END $function$;
