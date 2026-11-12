DO $$
DECLARE r record; u text; c text; gate text := 'app_security.internal_user_authorized()';
BEGIN
  FOR r IN SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
           WHERE schemaname='public' AND permissive='PERMISSIVE' AND (qual='true' OR with_check='true') LOOP
    IF r.tablename='admission_files' THEN
      u := gate||' OR app_security.admission_link_allows(request_id, false)';
      c := gate||' OR app_security.admission_link_allows(request_id, true)';
    ELSIF r.tablename='admission_requests' THEN
      u := gate||' OR app_security.admission_link_allows(id, false)';
      c := gate||' OR app_security.admission_link_allows(id, true)';
    ELSIF r.tablename='admission_form_templates' THEN
      u := gate||' OR is_published'; c := gate;
    ELSE u := gate; c := gate; END IF;
    IF r.cmd='INSERT' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, c);
    ELSIF r.cmd IN ('SELECT','DELETE') THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, u);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', r.policyname, r.tablename, u, c);
    END IF;
  END LOOP;

  FOR r IN SELECT policyname, cmd, qual, with_check FROM pg_policies
           WHERE schemaname='storage' AND tablename='objects' AND permissive='PERMISSIVE'
             AND 'authenticated' = ANY(roles)
             AND coalesce(qual, with_check) ~ '^\(bucket_id = ''[a-z-]+''::text\)$' LOOP
    u := '(' || coalesce(r.qual, r.with_check) || ' AND ' || gate || ')';
    IF r.cmd='INSERT' THEN
      EXECUTE format('ALTER POLICY %I ON storage.objects WITH CHECK %s', r.policyname, u);
    ELSIF r.cmd IN ('SELECT','DELETE') THEN
      EXECUTE format('ALTER POLICY %I ON storage.objects USING %s', r.policyname, u);
    ELSE
      EXECUTE format('ALTER POLICY %I ON storage.objects USING %s WITH CHECK %s', r.policyname, u, u);
    END IF;
  END LOOP;
END $$;