DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.premiacao_apurar(uuid,text)'::regprocedure);
  EXECUTE replace(d, 'IF auth.uid() IS NULL THEN', 'IF auth.uid() IS NULL AND COALESCE(auth.role(),'''') <> ''service_role'' THEN');
  d := pg_get_functiondef('public.premiacao_fechar(uuid,text)'::regprocedure);
  EXECUTE replace(d, 'IF auth.uid() IS NULL THEN', 'IF auth.uid() IS NULL AND COALESCE(auth.role(),'''') <> ''service_role'' THEN');
  d := pg_get_functiondef('public.premiacao_reabrir(uuid,text)'::regprocedure);
  EXECUTE replace(d, 'IF NOT public.is_admin_or_master(auth.uid()) THEN', 'IF COALESCE(auth.role(),'''') <> ''service_role'' AND NOT public.is_admin_or_master(auth.uid()) THEN');
END $$;