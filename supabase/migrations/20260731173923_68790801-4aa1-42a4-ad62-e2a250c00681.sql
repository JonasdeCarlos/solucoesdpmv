CREATE POLICY "cliente_dp_uploads_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'cliente-dp-uploads');
CREATE POLICY "cliente_dp_uploads_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cliente-dp-uploads');
CREATE POLICY "cliente_dp_uploads_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cliente-dp-uploads') WITH CHECK (bucket_id = 'cliente-dp-uploads');
CREATE POLICY "cliente_dp_uploads_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cliente-dp-uploads');