CREATE OR REPLACE FUNCTION public.internal_user_authorized()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('master','admin','user')); $$;
REVOKE ALL ON FUNCTION public.internal_user_authorized() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_user_authorized() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admission_link_allows(_request_id uuid, _write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.admission_requests WHERE id = _request_id AND token = (COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-admission-token') AND (NOT _write OR status = 'rascunho')); $$;
REVOKE ALL ON FUNCTION public.admission_link_allows(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admission_link_allows(uuid,boolean) TO anon, authenticated, service_role;

DO $$ DECLARE t record; BEGIN
FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('admission_requests','admission_files','admission_form_templates') LOOP
EXECUTE format('CREATE POLICY internal_authorized_only ON public.%I AS RESTRICTIVE FOR ALL TO public USING (public.internal_user_authorized()) WITH CHECK (public.internal_user_authorized())', t.tablename);
END LOOP;
END $$;

CREATE POLICY internal_or_admission_link ON public.admission_requests AS RESTRICTIVE FOR ALL TO public
USING (public.internal_user_authorized() OR public.admission_link_allows(id, false))
WITH CHECK (public.internal_user_authorized() OR (public.admission_link_allows(id, true) AND status IN ('rascunho','enviado')));
CREATE POLICY internal_or_admission_file_link ON public.admission_files AS RESTRICTIVE FOR ALL TO public
USING (public.internal_user_authorized() OR public.admission_link_allows(request_id, false))
WITH CHECK (public.internal_user_authorized() OR (public.admission_link_allows(request_id, true) AND storage_path LIKE 'requests/' || request_id::text || '/%'));
CREATE POLICY internal_or_published_template_read ON public.admission_form_templates AS RESTRICTIVE FOR SELECT TO public
USING (public.internal_user_authorized() OR is_published);
CREATE POLICY internal_template_insert ON public.admission_form_templates AS RESTRICTIVE FOR INSERT TO public WITH CHECK (public.internal_user_authorized());
CREATE POLICY internal_template_update ON public.admission_form_templates AS RESTRICTIVE FOR UPDATE TO public USING (public.internal_user_authorized()) WITH CHECK (public.internal_user_authorized());
CREATE POLICY internal_template_delete ON public.admission_form_templates AS RESTRICTIVE FOR DELETE TO public USING (public.internal_user_authorized());

REVOKE ALL ON public.admission_requests, public.admission_files, public.admission_form_templates FROM anon;
GRANT SELECT ON public.admission_requests TO anon;
GRANT UPDATE (draft_answers, answers, status, submitted_at) ON public.admission_requests TO anon;
GRANT SELECT, INSERT, DELETE ON public.admission_files TO anon;
GRANT SELECT ON public.admission_form_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_requests, public.admission_files, public.admission_form_templates TO authenticated;
GRANT ALL ON public.admission_requests, public.admission_files, public.admission_form_templates TO service_role;

CREATE OR REPLACE FUNCTION public.create_public_admission(_template_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE tpl public.admission_form_templates%ROWTYPE; new_token text;
BEGIN
SELECT * INTO tpl FROM public.admission_form_templates WHERE id = _template_id AND is_published;
IF NOT FOUND THEN RAISE EXCEPTION 'Formulário indisponível'; END IF;
new_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
INSERT INTO public.admission_requests (template_id,template_name_snapshot,template_schema_snapshot,company_name,company_cnpj,employee_name,token,status)
VALUES (tpl.id,tpl.name,tpl.schema_json,'','','',new_token,'rascunho');
RETURN new_token;
END; $$;
REVOKE ALL ON FUNCTION public.create_public_admission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_admission(uuid) TO anon, authenticated, service_role;

CREATE POLICY internal_storage_read_gate ON storage.objects AS RESTRICTIVE FOR SELECT TO public
USING (public.internal_user_authorized() OR (bucket_id = 'admissao-uploads' AND EXISTS (SELECT 1 FROM public.admission_requests r WHERE split_part(name,'/',1) = 'requests' AND split_part(name,'/',2) = r.id::text AND public.admission_link_allows(r.id,false))));
CREATE POLICY internal_storage_insert_gate ON storage.objects AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (public.internal_user_authorized() OR (bucket_id = 'admissao-uploads' AND EXISTS (SELECT 1 FROM public.admission_requests r WHERE split_part(name,'/',1) = 'requests' AND split_part(name,'/',2) = r.id::text AND public.admission_link_allows(r.id,true))));
CREATE POLICY internal_storage_update_gate ON storage.objects AS RESTRICTIVE FOR UPDATE TO public USING (public.internal_user_authorized()) WITH CHECK (public.internal_user_authorized());
CREATE POLICY internal_storage_delete_gate ON storage.objects AS RESTRICTIVE FOR DELETE TO public
USING (public.internal_user_authorized() OR (bucket_id = 'admissao-uploads' AND EXISTS (SELECT 1 FROM public.admission_requests r WHERE split_part(name,'/',1) = 'requests' AND split_part(name,'/',2) = r.id::text AND public.admission_link_allows(r.id,true))));
CREATE POLICY admission_link_read_files ON storage.objects FOR SELECT TO anon USING (bucket_id = 'admissao-uploads');
CREATE POLICY admission_link_delete_files ON storage.objects FOR DELETE TO anon USING (bucket_id = 'admissao-uploads');