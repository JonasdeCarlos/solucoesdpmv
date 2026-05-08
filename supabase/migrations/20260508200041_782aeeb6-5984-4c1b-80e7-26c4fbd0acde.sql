
CREATE TABLE public.admission_archive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_request_id UUID,
  employee_name TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  company_cnpj TEXT NOT NULL DEFAULT '',
  template_name TEXT NOT NULL DEFAULT '',
  previous_status TEXT NOT NULL DEFAULT '',
  original_created_at TIMESTAMP WITH TIME ZONE,
  request_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  admission_completed BOOLEAN NOT NULL DEFAULT false,
  responsible_name TEXT NOT NULL DEFAULT '',
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admission_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read admission_archive"
  ON public.admission_archive FOR SELECT USING (true);

CREATE POLICY "Allow insert admission_archive"
  ON public.admission_archive FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow delete admission_archive"
  ON public.admission_archive FOR DELETE USING (true);

CREATE INDEX idx_admission_archive_archived_at ON public.admission_archive (archived_at DESC);
