
ALTER TABLE public.aviso_empresas
  ADD COLUMN IF NOT EXISTS whatsapp_numeros text[] NOT NULL DEFAULT '{}';

-- Backfill: traz o número único existente para a lista (se ainda não estiver lá)
UPDATE public.aviso_empresas
   SET whatsapp_numeros = ARRAY[regexp_replace(whatsapp, '\D', '', 'g')]
 WHERE coalesce(whatsapp, '') <> ''
   AND (whatsapp_numeros IS NULL OR array_length(whatsapp_numeros, 1) IS NULL);

CREATE OR REPLACE FUNCTION public.sanitize_aviso_empresa_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v text;
  cleaned text[] := '{}';
BEGIN
  IF NEW.whatsapp IS NOT NULL THEN
    NEW.whatsapp := regexp_replace(NEW.whatsapp, '\D', '', 'g');
  END IF;
  IF NEW.whatsapp_numeros IS NOT NULL THEN
    FOREACH v IN ARRAY NEW.whatsapp_numeros LOOP
      v := regexp_replace(coalesce(v, ''), '\D', '', 'g');
      IF v <> '' AND NOT (v = ANY(cleaned)) THEN
        cleaned := array_append(cleaned, v);
      END IF;
    END LOOP;
    NEW.whatsapp_numeros := cleaned;
  END IF;
  -- mantém o campo legado em sincronia (primeiro número da lista)
  IF NEW.whatsapp_numeros IS NOT NULL AND array_length(NEW.whatsapp_numeros, 1) >= 1 THEN
    NEW.whatsapp := NEW.whatsapp_numeros[1];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_aviso_empresa_whatsapp ON public.aviso_empresas;
CREATE TRIGGER trg_sanitize_aviso_empresa_whatsapp
  BEFORE INSERT OR UPDATE OF whatsapp, whatsapp_numeros ON public.aviso_empresas
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_aviso_empresa_whatsapp();
