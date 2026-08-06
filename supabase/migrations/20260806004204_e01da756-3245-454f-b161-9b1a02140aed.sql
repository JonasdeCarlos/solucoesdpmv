DROP POLICY IF EXISTS "Allow all read admissao-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all insert admissao-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all update admissao-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow all delete admissao-uploads" ON storage.objects;

CREATE POLICY "admissao_uploads_public_insert"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'admissao-uploads' AND (storage.foldername(name))[1] = 'requests');

CREATE POLICY "admissao_uploads_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admissao-uploads');

CREATE POLICY "admissao_uploads_auth_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'admissao-uploads');

CREATE POLICY "admissao_uploads_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'admissao-uploads')
  WITH CHECK (bucket_id = 'admissao-uploads');

CREATE POLICY "admissao_uploads_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'admissao-uploads');