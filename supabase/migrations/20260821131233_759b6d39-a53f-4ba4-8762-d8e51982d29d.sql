create policy "Authenticated can read ponto pdfs" on storage.objects for select to authenticated using (bucket_id = 'ponto-pdfs');
create policy "Authenticated can upload ponto pdfs" on storage.objects for insert to authenticated with check (bucket_id = 'ponto-pdfs');
create policy "Authenticated can update ponto pdfs" on storage.objects for update to authenticated using (bucket_id = 'ponto-pdfs') with check (bucket_id = 'ponto-pdfs');
create policy "Authenticated can delete ponto pdfs" on storage.objects for delete to authenticated using (bucket_id = 'ponto-pdfs');