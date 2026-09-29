CREATE OR REPLACE FUNCTION public.premiacao_apurar(p_politica_id uuid, p_competencia text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  pol premiacao_politicas%ROWTYPE;
  c record; m record;
  v_ini int; v_prev_neg int; v_med int; v_med_cnt jsonb; v_tro int; v_tro_list jsonb; v_des int;
  v_pos int; v_saldo int; v_ref int; v_prem int; v_valor numeric; v_transp int; v_neg int; v_real int; v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO pol FROM premiacao_politicas WHERE id = p_politica_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Política não encontrada'; END IF;

  FOR c IN SELECT * FROM premiacao_colaboradores WHERE empresa_id = pol.empresa_id
       AND (ativo OR EXISTS (SELECT 1 FROM premiacao_lancamentos l WHERE l.colaborador_id = premiacao_colaboradores.id AND l.politica_id = p_politica_id AND l.competencia = p_competencia))
  LOOP
    IF EXISTS (SELECT 1 FROM premiacao_apuracoes WHERE politica_id=p_politica_id AND colaborador_id=c.id AND competencia=p_competencia AND status<>'aberta') THEN
      CONTINUE;
    END IF;

    SELECT a.saldo_transportado, a.meses_negativos INTO v_ini, v_prev_neg FROM premiacao_apuracoes a
      WHERE a.politica_id=p_politica_id AND a.colaborador_id=c.id AND a.competencia < p_competencia AND a.status <> 'aberta'
      ORDER BY a.competencia DESC LIMIT 1;
    v_ini := COALESCE(v_ini,0); v_prev_neg := COALESCE(v_prev_neg,0);

    SELECT COALESCE(SUM(l.quantidade*l.pontos_unitarios),0) INTO v_med FROM premiacao_lancamentos l
      WHERE l.politica_id=p_politica_id AND l.colaborador_id=c.id AND l.competencia=p_competencia AND l.tipo='servico' AND l.gera_pontos;
    SELECT COALESCE(jsonb_object_agg(nome, qtd), '{}'::jsonb) INTO v_med_cnt FROM (
      SELECT md.nome, SUM(l.quantidade) qtd FROM premiacao_lancamentos l
        JOIN premiacao_servicos s ON s.id=l.servico_id JOIN premiacao_medalhas md ON md.id=s.medalha_id
       WHERE l.politica_id=p_politica_id AND l.colaborador_id=c.id AND l.competencia=p_competencia AND l.tipo='servico' AND l.gera_pontos
       GROUP BY md.nome) x;
    SELECT COALESCE(SUM(l.pontos_total),0) INTO v_des FROM premiacao_lancamentos l
      WHERE l.politica_id=p_politica_id AND l.colaborador_id=c.id AND l.competencia=p_competencia AND l.tipo='desabono';
    v_med := v_med + COALESCE((SELECT SUM(l.pontos_total) FROM premiacao_lancamentos l
      WHERE l.politica_id=p_politica_id AND l.colaborador_id=c.id AND l.competencia=p_competencia AND l.tipo='ajuste'),0);

    v_tro := 0; v_tro_list := '[]'::jsonb;
    FOR m IN SELECT * FROM premiacao_metas WHERE politica_id=p_politica_id AND ativo LOOP
      IF m.modo_apuracao = 'manual' THEN
        v_real := NULL;
        v_ok := EXISTS (SELECT 1 FROM premiacao_metas_manuais mm WHERE mm.meta_id=m.id AND mm.colaborador_id=c.id AND mm.competencia=p_competencia AND mm.atingida);
      ELSE
        SELECT COALESCE(SUM(l.quantidade*ms.peso_contagem),0) INTO v_real FROM premiacao_lancamentos l
          JOIN premiacao_metas_servicos ms ON ms.servico_id=l.servico_id AND ms.meta_id=m.id
         WHERE l.politica_id=p_politica_id AND l.colaborador_id=c.id AND l.competencia=p_competencia AND l.tipo='servico';
        v_ok := v_real >= m.quantidade_alvo;
      END IF;
      IF v_ok THEN v_tro := v_tro + m.pontos_trofeu; END IF;
      v_tro_list := v_tro_list || jsonb_build_object('meta_id',m.id,'nome',m.nome,'realizado',v_real,'alvo',m.quantidade_alvo,'unidade',m.unidade,'atingida',v_ok,'pontos',CASE WHEN v_ok THEN m.pontos_trofeu ELSE 0 END);
    END LOOP;

    v_pos := v_med + v_tro;
    IF pol.teto_mensal_pontos IS NOT NULL AND v_pos > pol.teto_mensal_pontos THEN v_pos := pol.teto_mensal_pontos; END IF;
    v_saldo := v_ini + v_pos - v_des;

    SELECT r.pontuacao_referencia INTO v_ref FROM premiacao_referencias r WHERE r.politica_id=p_politica_id AND r.cargo_id=c.cargo_id;
    v_ref := COALESCE(v_ref, pol.pontuacao_referencia_padrao, 0);

    IF v_saldo < 0 THEN
      v_prem := 0; v_valor := 0; v_neg := v_prev_neg + 1;
      v_transp := CASE WHEN pol.limite_saldo_negativo IS NOT NULL THEN GREATEST(v_saldo, pol.limite_saldo_negativo) ELSE v_saldo END;
      IF pol.meses_max_transporte IS NOT NULL AND v_neg >= pol.meses_max_transporte THEN v_transp := 0; v_neg := 0; END IF;
      IF c.data_desligamento IS NOT NULL AND to_char(c.data_desligamento,'YYYY-MM') <= p_competencia THEN v_transp := 0; END IF;
    ELSE
      -- Gatilho: ultrapassou a referência => faz jus a todos os pontos do mês
      v_prem := CASE WHEN v_saldo > v_ref THEN v_saldo ELSE 0 END; v_valor := round(v_prem * pol.valor_ponto, 2); v_transp := 0; v_neg := 0;
    END IF;

    INSERT INTO premiacao_apuracoes (empresa_id,politica_id,colaborador_id,competencia,saldo_inicial,pontos_medalhas,medalhas_contagem,pontos_trofeus,trofeus_conquistados,pontos_desabonos,saldo_apurado,pontuacao_referencia,pontos_premiaveis,valor_ponto,valor_bonificacao,saldo_transportado,meses_negativos,status)
    VALUES (pol.empresa_id,p_politica_id,c.id,p_competencia,v_ini,v_med,v_med_cnt,v_tro,v_tro_list,v_des,v_saldo,v_ref,v_prem,pol.valor_ponto,v_valor,v_transp,v_neg,'aberta')
    ON CONFLICT (politica_id,colaborador_id,competencia) DO UPDATE SET
      saldo_inicial=EXCLUDED.saldo_inicial, pontos_medalhas=EXCLUDED.pontos_medalhas, medalhas_contagem=EXCLUDED.medalhas_contagem,
      pontos_trofeus=EXCLUDED.pontos_trofeus, trofeus_conquistados=EXCLUDED.trofeus_conquistados, pontos_desabonos=EXCLUDED.pontos_desabonos,
      saldo_apurado=EXCLUDED.saldo_apurado, pontuacao_referencia=EXCLUDED.pontuacao_referencia, pontos_premiaveis=EXCLUDED.pontos_premiaveis,
      valor_ponto=EXCLUDED.valor_ponto, valor_bonificacao=EXCLUDED.valor_bonificacao, saldo_transportado=EXCLUDED.saldo_transportado,
      meses_negativos=EXCLUDED.meses_negativos;
  END LOOP;
END $$;