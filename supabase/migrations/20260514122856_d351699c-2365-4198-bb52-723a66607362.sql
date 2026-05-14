
-- 1. Enum de papéis
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('master', 'admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. invited_emails (allowlist)
CREATE TABLE IF NOT EXISTS public.invited_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'user',
  invited_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invited_emails ENABLE ROW LEVEL SECURITY;

-- 4. has_role (security definer, evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 4b. is_admin_or_master
CREATE OR REPLACE FUNCTION public.is_admin_or_master(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('master','admin')
  )
$$;

-- 5. Normaliza e-mail
CREATE OR REPLACE FUNCTION public.normalize_email(_email text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(trim(_email)) $$;

-- 6. Seed: jonas é master e está na allowlist
INSERT INTO public.invited_emails (email, role, invited_by)
VALUES ('jonas@contabilmv.com', 'master', 'system')
ON CONFLICT (email) DO UPDATE SET role = 'master';

-- 7. Trigger: bloqueia signup se e-mail não estiver convidado, e atribui papel
CREATE OR REPLACE FUNCTION public.handle_new_user_invited()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
  _invited public.invited_emails%ROWTYPE;
BEGIN
  _email := public.normalize_email(NEW.email);
  SELECT * INTO _invited FROM public.invited_emails WHERE email = _email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E-mail não autorizado. Solicite convite ao administrador.'
      USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _invited.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_invited ON auth.users;
CREATE TRIGGER on_auth_user_created_invited
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_invited();

-- 8. Sincroniza papéis para usuários existentes que já estão na allowlist
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, ie.role
FROM auth.users u
JOIN public.invited_emails ie ON ie.email = public.normalize_email(u.email)
ON CONFLICT (user_id, role) DO NOTHING;

-- 9. RLS user_roles
DROP POLICY IF EXISTS "users see own roles" ON public.user_roles;
CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_master(auth.uid()));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- 10. RLS invited_emails (somente master/admin)
DROP POLICY IF EXISTS "admins manage invited" ON public.invited_emails;
CREATE POLICY "admins manage invited" ON public.invited_emails
  FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));
