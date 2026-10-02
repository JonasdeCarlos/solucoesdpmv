UPDATE public.ts_competencias c
SET saldo_nao_distribuido = sub.dif
FROM (
  SELECT d.competencia_id, ROUND(SUM(d.valor_comissao) - SUM(COALESCE(d.valor_ajustado, d.valor_comissao)), 2) AS dif
  FROM public.ts_distribuicao d GROUP BY d.competencia_id
) sub
WHERE sub.competencia_id = c.id AND c.status = 'ajustado' AND c.saldo_nao_distribuido IS DISTINCT FROM sub.dif;