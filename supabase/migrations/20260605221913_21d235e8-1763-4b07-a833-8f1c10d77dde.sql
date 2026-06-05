
CREATE POLICY "dp uploads read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cliente-dp-uploads');
CREATE POLICY "dp uploads ins" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cliente-dp-uploads');
CREATE POLICY "dp uploads upd" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cliente-dp-uploads') WITH CHECK (bucket_id = 'cliente-dp-uploads');
CREATE POLICY "dp uploads del" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cliente-dp-uploads');
