ALTER TABLE public.avisos
ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE OR REPLACE FUNCTION public.set_aviso_dedupe_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.dedupe_key :=
    trim(coalesce(NEW.empresa_code, '')) || '|' ||
    trim(coalesce(NEW.employee_code, '')) || '|' ||
    translate(
      upper(regexp_replace(trim(coalesce(NEW.employee_name, '')), '\s+', ' ', 'g')),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'AAAAAEEEEIIIIOOOOOUUUUCN'
    ) || '|' ||
    trim(coalesce(NEW.motivo, '')) || '|' ||
    coalesce(NEW.due_date::text, '') || '|' ||
    coalesce(NEW.limit_date::text, '');
  RETURN NEW;
END;
$$;

UPDATE public.avisos
SET unique_hash = unique_hash
WHERE dedupe_key IS NULL;

DROP TRIGGER IF EXISTS trg_avisos_dedupe_key ON public.avisos;
CREATE TRIGGER trg_avisos_dedupe_key
BEFORE INSERT OR UPDATE OF empresa_code, employee_code, employee_name, motivo, due_date, limit_date
ON public.avisos
FOR EACH ROW
EXECUTE FUNCTION public.set_aviso_dedupe_key();

CREATE UNIQUE INDEX IF NOT EXISTS avisos_dedupe_key_unique
ON public.avisos (dedupe_key);