
-- Helper: drop existing permissive policies and recreate restricted to authenticated

-- clientes
DROP POLICY IF EXISTS "Allow all access to clientes" ON public.clientes;
CREATE POLICY "Authenticated full access clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- empregados
DROP POLICY IF EXISTS "Allow all access to empregados" ON public.empregados;
CREATE POLICY "Authenticated full access empregados" ON public.empregados FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vacation_calculations
DROP POLICY IF EXISTS "Allow all access to vacation_calculations" ON public.vacation_calculations;
CREATE POLICY "Authenticated full access vacation_calculations" ON public.vacation_calculations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vacation_receipts
DROP POLICY IF EXISTS "Allow all access to vacation_receipts" ON public.vacation_receipts;
CREATE POLICY "Authenticated full access vacation_receipts" ON public.vacation_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- provision_entries
DROP POLICY IF EXISTS "Allow all access to provision_entries" ON public.provision_entries;
CREATE POLICY "Authenticated full access provision_entries" ON public.provision_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- dsr_monthly_results
DROP POLICY IF EXISTS "Allow all access to dsr_monthly_results" ON public.dsr_monthly_results;
CREATE POLICY "Authenticated full access dsr_monthly_results" ON public.dsr_monthly_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- banco_horas
DROP POLICY IF EXISTS "Allow all access to banco_horas" ON public.banco_horas;
CREATE POLICY "Authenticated full access banco_horas" ON public.banco_horas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ponto_ocr_audit
DROP POLICY IF EXISTS "Allow all access to ponto_ocr_audit" ON public.ponto_ocr_audit;
CREATE POLICY "Authenticated full access ponto_ocr_audit" ON public.ponto_ocr_audit FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- rescisao_dossiers
DROP POLICY IF EXISTS "Allow all access to rescisao_dossiers" ON public.rescisao_dossiers;
CREATE POLICY "Authenticated full access rescisao_dossiers" ON public.rescisao_dossiers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- rescisao_dossier_files
DROP POLICY IF EXISTS "Allow all access to rescisao_dossier_files" ON public.rescisao_dossier_files;
CREATE POLICY "Authenticated full access rescisao_dossier_files" ON public.rescisao_dossier_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- rescisao_cover_templates
DROP POLICY IF EXISTS "Allow all access to rescisao_cover_templates" ON public.rescisao_cover_templates;
CREATE POLICY "Authenticated full access rescisao_cover_templates" ON public.rescisao_cover_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sero_obras
DROP POLICY IF EXISTS "Allow all access to sero_obras" ON public.sero_obras;
CREATE POLICY "Authenticated full access sero_obras" ON public.sero_obras FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sero_retencoes
DROP POLICY IF EXISTS "Allow all access to sero_retencoes" ON public.sero_retencoes;
CREATE POLICY "Authenticated full access sero_retencoes" ON public.sero_retencoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- sero_deducoes
DROP POLICY IF EXISTS "Allow all access to sero_deducoes" ON public.sero_deducoes;
CREATE POLICY "Authenticated full access sero_deducoes" ON public.sero_deducoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- cprb_simulations
DROP POLICY IF EXISTS "Allow all access to cprb_simulations" ON public.cprb_simulations;
CREATE POLICY "Authenticated full access cprb_simulations" ON public.cprb_simulations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- cprb_obras
DROP POLICY IF EXISTS "Allow all access to cprb_obras" ON public.cprb_obras;
CREATE POLICY "Authenticated full access cprb_obras" ON public.cprb_obras FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- cprb_simulation_results
DROP POLICY IF EXISTS "Allow all access to cprb_simulation_results" ON public.cprb_simulation_results;
CREATE POLICY "Authenticated full access cprb_simulation_results" ON public.cprb_simulation_results FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- avisos
DROP POLICY IF EXISTS "Allow all access to avisos" ON public.avisos;
CREATE POLICY "Authenticated full access avisos" ON public.avisos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to aviso_empresas" ON public.aviso_empresas;
CREATE POLICY "Authenticated full access aviso_empresas" ON public.aviso_empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to aviso_imports" ON public.aviso_imports;
CREATE POLICY "Authenticated full access aviso_imports" ON public.aviso_imports FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to aviso_contact_attempts" ON public.aviso_contact_attempts;
CREATE POLICY "Authenticated full access aviso_contact_attempts" ON public.aviso_contact_attempts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage buckets: ponto-uploads, rescisao-docs, aviso-pdfs -> authenticated only
-- Drop any existing policies referencing these buckets
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%ponto-uploads%' OR qual LIKE '%rescisao-docs%' OR qual LIKE '%aviso-pdfs%'
        OR with_check LIKE '%ponto-uploads%' OR with_check LIKE '%rescisao-docs%' OR with_check LIKE '%aviso-pdfs%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated read ponto-uploads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ponto-uploads');
CREATE POLICY "Authenticated insert ponto-uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ponto-uploads');
CREATE POLICY "Authenticated update ponto-uploads" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'ponto-uploads') WITH CHECK (bucket_id = 'ponto-uploads');
CREATE POLICY "Authenticated delete ponto-uploads" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ponto-uploads');

CREATE POLICY "Authenticated read rescisao-docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'rescisao-docs');
CREATE POLICY "Authenticated insert rescisao-docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'rescisao-docs');
CREATE POLICY "Authenticated update rescisao-docs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'rescisao-docs') WITH CHECK (bucket_id = 'rescisao-docs');
CREATE POLICY "Authenticated delete rescisao-docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'rescisao-docs');

CREATE POLICY "Authenticated read aviso-pdfs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'aviso-pdfs');
CREATE POLICY "Authenticated insert aviso-pdfs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'aviso-pdfs');
CREATE POLICY "Authenticated update aviso-pdfs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'aviso-pdfs') WITH CHECK (bucket_id = 'aviso-pdfs');
CREATE POLICY "Authenticated delete aviso-pdfs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'aviso-pdfs');
