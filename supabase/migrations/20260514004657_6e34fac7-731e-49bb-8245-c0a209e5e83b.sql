
-- Atualiza dedupe para considerar apenas motivo + employee_name + due_date
CREATE OR REPLACE FUNCTION public.set_aviso_dedupe_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.dedupe_key :=
    trim(coalesce(NEW.motivo, '')) || '|' ||
    translate(
      upper(regexp_replace(trim(coalesce(NEW.employee_name, '')), '\s+', ' ', 'g')),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'AAAAAEEEEIIIIOOOOOUUUUCN'
    ) || '|' ||
    coalesce(NEW.due_date::text, '');
  RETURN NEW;
END;
$function$;

-- Recalcula dedupe_key para todos os avisos existentes
UPDATE public.avisos SET dedupe_key = dedupe_key WHERE true;

-- Remove duplicatas mantendo o aviso mais antigo (com seus contatos preservados via cascade lógico)
WITH ranked AS (
  SELECT id, dedupe_key,
    ROW_NUMBER() OVER (PARTITION BY dedupe_key ORDER BY created_at ASC, id ASC) AS rn
  FROM public.avisos
)
DELETE FROM public.aviso_contact_attempts
WHERE aviso_id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT id, dedupe_key,
    ROW_NUMBER() OVER (PARTITION BY dedupe_key ORDER BY created_at ASC, id ASC) AS rn
  FROM public.avisos
)
DELETE FROM public.avisos WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
