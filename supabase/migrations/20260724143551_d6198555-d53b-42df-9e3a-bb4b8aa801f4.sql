
CREATE POLICY "Allow all read admissao-uploads" ON storage.objects FOR SELECT USING (bucket_id = 'admissao-uploads');
CREATE POLICY "Allow all insert admissao-uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'admissao-uploads');
CREATE POLICY "Allow all update admissao-uploads" ON storage.objects FOR UPDATE USING (bucket_id = 'admissao-uploads');
CREATE POLICY "Allow all delete admissao-uploads" ON storage.objects FOR DELETE USING (bucket_id = 'admissao-uploads');
