UPDATE public.avisos
SET dedupe_key =
  trim(coalesce(empresa_code, '')) || '|' ||
  trim(coalesce(employee_code, '')) || '|' ||
  translate(
    upper(regexp_replace(trim(coalesce(employee_name, '')), '\s+', ' ', 'g')),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'AAAAAEEEEIIIIOOOOOUUUUCN'
  ) || '|' ||
  trim(coalesce(motivo, '')) || '|' ||
  coalesce(due_date::text, '') || '|' ||
  coalesce(limit_date::text, '')
WHERE dedupe_key IS NULL OR dedupe_key = '';

ALTER TABLE public.avisos
ALTER COLUMN dedupe_key SET NOT NULL;