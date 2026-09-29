REVOKE EXECUTE ON FUNCTION public.premiacao_log_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.premiacao_reabrir(uuid, text) FROM PUBLIC, anon;
ALTER FUNCTION public.premiacao_reabrir(uuid, text) SECURITY INVOKER;
ALTER FUNCTION public.premiacao_log_trigger() SECURITY INVOKER;