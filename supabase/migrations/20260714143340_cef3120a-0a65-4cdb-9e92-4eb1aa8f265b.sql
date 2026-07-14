
CREATE POLICY "cct-docs read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'cct-docs');
CREATE POLICY "cct-docs insert auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cct-docs');
CREATE POLICY "cct-docs update auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cct-docs') WITH CHECK (bucket_id = 'cct-docs');
CREATE POLICY "cct-docs delete admin" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cct-docs' AND public.is_admin_or_master(auth.uid()));
