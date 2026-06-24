CREATE POLICY "Public insert rescisao-docs" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'rescisao-docs');
CREATE POLICY "Public read rescisao-docs" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'rescisao-docs');
CREATE POLICY "Public update rescisao-docs" ON storage.objects FOR UPDATE TO anon USING (bucket_id = 'rescisao-docs') WITH CHECK (bucket_id = 'rescisao-docs');
CREATE POLICY "Public delete rescisao-docs" ON storage.objects FOR DELETE TO anon USING (bucket_id = 'rescisao-docs');