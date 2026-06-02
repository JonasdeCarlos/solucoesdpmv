
-- Limpeza de feriados duplicados
-- 1) Remove cópias nacionais por UF quando já existe a versão "todos/uf=null"
WITH norm AS (
  SELECT id, data,
         upper(translate(nome,'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ','aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) AS nnome,
         tipo, scope_type, uf, municipio
  FROM public.holidays
),
canon AS (
  SELECT data, nnome FROM norm
  WHERE tipo='nacional' AND scope_type='todos' AND uf IS NULL AND municipio IS NULL
)
DELETE FROM public.holidays h USING norm n, canon c
WHERE h.id = n.id
  AND n.data = c.data AND n.nnome = c.nnome
  AND n.tipo='nacional' AND n.scope_type='todos' AND n.uf IS NOT NULL;

-- 2) Remove cópias municipais/pf de feriados nacionalmente reconhecidos
-- quando já há um ponto facultativo nacional (scope=todos) na mesma data+nome
WITH norm AS (
  SELECT id, data,
         upper(translate(nome,'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ','aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) AS nnome,
         tipo, scope_type, uf, municipio
  FROM public.holidays
),
canon AS (
  SELECT data, nnome FROM norm
  WHERE scope_type='todos' AND uf IS NULL AND municipio IS NULL
    AND (tipo='ponto_facultativo' OR tipo='nacional')
)
DELETE FROM public.holidays h USING norm n, canon c
WHERE h.id = n.id
  AND n.data = c.data AND n.nnome = c.nnome
  AND n.scope_type <> 'todos';

-- 3) Para qualquer remanescente com mesma (data, nome_normalizado, scope_type, uf, municipio),
-- mantém apenas o registro mais antigo
WITH norm AS (
  SELECT id, created_at, data,
         upper(translate(nome,'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ','aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) AS nnome,
         scope_type, COALESCE(uf,'') uf, COALESCE(municipio,'') municipio
  FROM public.holidays
),
ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY data, nnome, scope_type, uf, municipio ORDER BY created_at ASC) rn
  FROM norm
)
DELETE FROM public.holidays WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
