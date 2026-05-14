ALTER TABLE public.aviso_imports
ADD COLUMN IF NOT EXISTS file_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS aviso_imports_file_hash_unique
ON public.aviso_imports (file_hash)
WHERE file_hash IS NOT NULL AND file_hash <> '';