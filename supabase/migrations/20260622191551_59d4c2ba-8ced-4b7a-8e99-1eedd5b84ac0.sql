
CREATE POLICY "auditoria-docs public read" ON storage.objects FOR SELECT USING (bucket_id = 'auditoria-docs');
CREATE POLICY "auditoria-docs public insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'auditoria-docs');
CREATE POLICY "auditoria-docs public update" ON storage.objects FOR UPDATE USING (bucket_id = 'auditoria-docs');
CREATE POLICY "auditoria-docs public delete" ON storage.objects FOR DELETE USING (bucket_id = 'auditoria-docs');
