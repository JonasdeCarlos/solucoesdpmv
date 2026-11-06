CREATE SCHEMA IF NOT EXISTS app_security;
REVOKE ALL ON SCHEMA app_security FROM PUBLIC;
GRANT USAGE ON SCHEMA app_security TO anon, authenticated, service_role;
ALTER FUNCTION public.internal_user_authorized() SET SCHEMA app_security;
ALTER FUNCTION public.admission_link_allows(uuid,boolean) SET SCHEMA app_security;
ALTER FUNCTION public.create_public_admission(uuid) SET SCHEMA app_security;
CREATE OR REPLACE FUNCTION public.create_public_admission(_template_id uuid)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT app_security.create_public_admission(_template_id); $$;
REVOKE ALL ON FUNCTION public.create_public_admission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_admission(uuid) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION app_security.admission_link_allows(_request_id uuid, _write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.admission_requests WHERE id = _request_id AND token = (COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-admission-token') AND (NOT _write OR status = 'rascunho')); $$;