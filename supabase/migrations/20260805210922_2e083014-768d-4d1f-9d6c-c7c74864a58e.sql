-- 1) Restrict policies to authenticated only
DROP POLICY IF EXISTS "auditorias all" ON public.auditorias;
CREATE POLICY "auditorias all" ON public.auditorias FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auditoria_itens all" ON public.auditoria_itens;
CREATE POLICY "auditoria_itens all" ON public.auditoria_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auditoria_acoes all" ON public.auditoria_acoes;
CREATE POLICY "auditoria_acoes all" ON public.auditoria_acoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auditoria_acao_files all" ON public.auditoria_acao_files;
CREATE POLICY "auditoria_acao_files all" ON public.auditoria_acao_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "avisos_envios_log_select_public" ON public.avisos_envios_log;
CREATE POLICY "avisos_envios_log_select_auth" ON public.avisos_envios_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cargos all" ON public.cargos;
CREATE POLICY "cargos all" ON public.cargos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "estruturas_salariais all" ON public.estruturas_salariais;
CREATE POLICY "estruturas_salariais all" ON public.estruturas_salariais FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admissao_notify_settings_all" ON public.admissao_notify_settings;
CREATE POLICY "admissao_notify_settings_all" ON public.admissao_notify_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) Remove anon table grants for these tables (service_role/edge functions keep access)
REVOKE ALL ON public.auditorias, public.auditoria_itens, public.auditoria_acoes, public.auditoria_acao_files,
  public.avisos_envios_log, public.cargos, public.estruturas_salariais, public.admissao_notify_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditorias, public.auditoria_itens, public.auditoria_acoes,
  public.auditoria_acao_files, public.cargos, public.estruturas_salariais, public.admissao_notify_settings TO authenticated;
GRANT SELECT ON public.avisos_envios_log TO authenticated;

-- 3) Lock down SECURITY DEFINER / helper functions
REVOKE ALL ON FUNCTION public.get_empregador_web_password(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_empregador_web_password(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_timeclock_password(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_timeclock_password(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_empregador_web_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_empregador_web_password(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_timeclock_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_timeclock_password(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin_or_master(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_master(uuid) TO authenticated, service_role;

-- trigger-only functions: not callable via API at all
REVOKE ALL ON FUNCTION public.handle_new_user_invited() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sanitize_aviso_empresa_whatsapp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_aviso_dedupe_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 4) Fix mutable search_path
CREATE OR REPLACE FUNCTION public.normalize_email(_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$ SELECT lower(trim(_email)) $function$;
REVOKE ALL ON FUNCTION public.normalize_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_email(text) TO authenticated, service_role;