
CREATE TABLE public.premiacao_politicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT 'Programa Excelência',
  valor_ponto numeric(12,2) NOT NULL DEFAULT 1.00,
  pontuacao_referencia_padrao int NOT NULL DEFAULT 0,
  teto_mensal_pontos int,
  limite_saldo_negativo int,
  meses_max_transporte int,
  codigo_rubrica_dominio text,
  vigencia_inicio date NOT NULL DEFAULT current_date,
  vigencia_fim date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.premiacao_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo text, nome text NOT NULL, cpf text,
  cargo_id uuid REFERENCES public.cargos(id) ON DELETE SET NULL,
  funcao text,
  ativo boolean NOT NULL DEFAULT true,
  data_desligamento date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.premiacao_referencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politica_id uuid NOT NULL REFERENCES public.premiacao_politicas(id) ON DELETE CASCADE,
  cargo_id uuid NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  pontuacao_referencia int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (politica_id, cargo_id)
);
CREATE TABLE public.premiacao_medalhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politica_id uuid NOT NULL REFERENCES public.premiacao_politicas(id) ON DELETE CASCADE,
  nome text NOT NULL, pontos_padrao int NOT NULL DEFAULT 0,
  cor_hex text NOT NULL DEFAULT '#628E3F', icone text DEFAULT 'medal',
  ordem int NOT NULL DEFAULT 0, ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.premiacao_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politica_id uuid NOT NULL REFERENCES public.premiacao_politicas(id) ON DELETE CASCADE,
  codigo text NOT NULL, descricao text NOT NULL,
  gera_pontos boolean NOT NULL DEFAULT true,
  medalha_id uuid REFERENCES public.premiacao_medalhas(id) ON DELETE SET NULL,
  pontos_override int, limite_por_competencia int,
  exige_comprovacao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (politica_id, codigo)
);
CREATE TABLE public.premiacao_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politica_id uuid NOT NULL REFERENCES public.premiacao_politicas(id) ON DELETE CASCADE,
  nome text NOT NULL, icone text DEFAULT 'trophy',
  quantidade_alvo int NOT NULL DEFAULT 1, unidade text,
  periodicidade text NOT NULL DEFAULT 'mensal',
  pontos_trofeu int NOT NULL DEFAULT 0,
  modo_apuracao text NOT NULL DEFAULT 'automatico',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.premiacao_metas_servicos (
  meta_id uuid NOT NULL REFERENCES public.premiacao_metas(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.premiacao_servicos(id) ON DELETE CASCADE,
  peso_contagem int NOT NULL DEFAULT 1,
  PRIMARY KEY (meta_id, servico_id)
);
CREATE TABLE public.premiacao_metas_manuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id uuid NOT NULL REFERENCES public.premiacao_metas(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.premiacao_colaboradores(id) ON DELETE CASCADE,
  competencia text NOT NULL, atingida boolean NOT NULL DEFAULT true,
  marcado_por uuid, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meta_id, colaborador_id, competencia)
);
CREATE TABLE public.premiacao_desabonos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politica_id uuid NOT NULL REFERENCES public.premiacao_politicas(id) ON DELETE CASCADE,
  codigo text NOT NULL, descricao text NOT NULL, pontos int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (politica_id, codigo)
);
CREATE TABLE public.premiacao_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  politica_id uuid NOT NULL REFERENCES public.premiacao_politicas(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.premiacao_colaboradores(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  data_ocorrencia date NOT NULL DEFAULT current_date,
  tipo text NOT NULL DEFAULT 'servico',
  servico_id uuid REFERENCES public.premiacao_servicos(id) ON DELETE SET NULL,
  desabono_id uuid REFERENCES public.premiacao_desabonos(id) ON DELETE SET NULL,
  codigo text, descricao text,
  quantidade int NOT NULL DEFAULT 1,
  pontos_unitarios int NOT NULL DEFAULT 0,
  pontos_total int NOT NULL DEFAULT 0,
  gera_pontos boolean NOT NULL DEFAULT true,
  referencia_os text, observacao text, anexo_url text,
  lancado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.premiacao_lancamentos (politica_id, competencia);
CREATE TABLE public.premiacao_apuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  politica_id uuid NOT NULL REFERENCES public.premiacao_politicas(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.premiacao_colaboradores(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  saldo_inicial int NOT NULL DEFAULT 0,
  pontos_medalhas int NOT NULL DEFAULT 0,
  medalhas_contagem jsonb NOT NULL DEFAULT '{}'::jsonb,
  pontos_trofeus int NOT NULL DEFAULT 0,
  trofeus_conquistados jsonb NOT NULL DEFAULT '[]'::jsonb,
  pontos_desabonos int NOT NULL DEFAULT 0,
  saldo_apurado int NOT NULL DEFAULT 0,
  pontuacao_referencia int NOT NULL DEFAULT 0,
  pontos_premiaveis int NOT NULL DEFAULT 0,
  valor_ponto numeric(12,2) NOT NULL DEFAULT 0,
  valor_bonificacao numeric(14,2) NOT NULL DEFAULT 0,
  saldo_transportado int NOT NULL DEFAULT 0,
  meses_negativos int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta',
  fechado_por uuid, fechado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (politica_id, colaborador_id, competencia)
);
CREATE TABLE public.premiacao_regulamento_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politica_id uuid NOT NULL REFERENCES public.premiacao_politicas(id) ON DELETE CASCADE,
  versao int NOT NULL, texto text NOT NULL DEFAULT '',
  vigencia_inicio date NOT NULL DEFAULT current_date,
  publicado_em timestamptz, publicado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (politica_id, versao)
);
CREATE TABLE public.premiacao_ciencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.premiacao_colaboradores(id) ON DELETE CASCADE,
  versao_regulamento_id uuid NOT NULL REFERENCES public.premiacao_regulamento_versoes(id) ON DELETE CASCADE,
  data_ciencia date NOT NULL DEFAULT current_date,
  forma text NOT NULL DEFAULT 'aceite_digital',
  anexo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, versao_regulamento_id)
);
CREATE TABLE public.premiacao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politica_id uuid, entidade text NOT NULL, entidade_id uuid,
  acao text NOT NULL, antes jsonb, depois jsonb,
  usuario_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['premiacao_politicas','premiacao_colaboradores','premiacao_referencias','premiacao_medalhas','premiacao_servicos','premiacao_metas','premiacao_metas_servicos','premiacao_metas_manuais','premiacao_desabonos','premiacao_lancamentos','premiacao_apuracoes','premiacao_regulamento_versoes','premiacao_ciencias','premiacao_log'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

CREATE TRIGGER trg_premiacao_politicas_upd BEFORE UPDATE ON public.premiacao_politicas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_premiacao_colab_upd BEFORE UPDATE ON public.premiacao_colaboradores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_premiacao_lanc_upd BEFORE UPDATE ON public.premiacao_lancamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_premiacao_apur_upd BEFORE UPDATE ON public.premiacao_apuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log
CREATE OR REPLACE FUNCTION public.premiacao_log_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.premiacao_log (politica_id, entidade, entidade_id, acao, antes, depois)
  VALUES (
    CASE WHEN TG_TABLE_NAME = 'premiacao_politicas' THEN COALESCE(NEW.id, OLD.id) ELSE COALESCE((to_jsonb(NEW)->>'politica_id')::uuid, (to_jsonb(OLD)->>'politica_id')::uuid) END,
    TG_TABLE_NAME, COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid),
    lower(TG_OP),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_premiacao_log_lanc AFTER INSERT OR UPDATE OR DELETE ON public.premiacao_lancamentos FOR EACH ROW EXECUTE FUNCTION public.premiacao_log_trigger();
CREATE TRIGGER trg_premiacao_log_pol AFTER UPDATE ON public.premiacao_politicas FOR EACH ROW EXECUTE FUNCTION public.premiacao_log_trigger();
CREATE TRIGGER trg_premiacao_log_reg AFTER UPDATE ON public.premiacao_regulamento_versoes FOR EACH ROW EXECUTE FUNCTION public.premiacao_log_trigger();

-- Seed
CREATE OR REPLACE FUNCTION public.premiacao_seed_politica(p_politica_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE o uuid; p uuid; b uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM premiacao_medalhas WHERE politica_id = p_politica_id) THEN RETURN; END IF;
  INSERT INTO premiacao_medalhas (politica_id,nome,pontos_padrao,cor_hex,icone,ordem) VALUES (p_politica_id,'Ouro',10,'#F5A623','medal',1) RETURNING id INTO o;
  INSERT INTO premiacao_medalhas (politica_id,nome,pontos_padrao,cor_hex,icone,ordem) VALUES (p_politica_id,'Prata',5,'#8E9AAF','medal',2) RETURNING id INTO p;
  INSERT INTO premiacao_medalhas (politica_id,nome,pontos_padrao,cor_hex,icone,ordem) VALUES (p_politica_id,'Bronze',3,'#C0602A','medal',3) RETURNING id INTO b;
  INSERT INTO premiacao_servicos (politica_id,codigo,descricao,medalha_id,limite_por_competencia) VALUES
   (p_politica_id,'001','Instalação sozinho',o,NULL),
   (p_politica_id,'002','Manutenção de drop rompido',o,NULL),
   (p_politica_id,'003','Indicação de venda (com instalação)',o,NULL),
   (p_politica_id,'004','Mudança de endereço',o,NULL),
   (p_politica_id,'005','Avaliação Google 5 estrelas (espontânea)',o,NULL),
   (p_politica_id,'006','Manutenção preventiva e organização do veículo (avaliação mensal)',o,1),
   (p_politica_id,'010','Instalação com ajudante',p,NULL),
   (p_politica_id,'011','Reparo com ajudante',p,NULL),
   (p_politica_id,'012','Mudança de endereço com ajudante',p,NULL),
   (p_politica_id,'013','Entrega de boleto (com confirmação)',p,NULL),
   (p_politica_id,'020','Chamado TV',b,NULL),
   (p_politica_id,'021','Chamado telefonia',b,NULL),
   (p_politica_id,'022','Chamado suporte equipamento',b,NULL);
  INSERT INTO premiacao_metas (politica_id,nome,quantidade_alvo,unidade,pontos_trofeu) VALUES
   (p_politica_id,'Instalações',20,'instalações',150),
   (p_politica_id,'Suporte ao cliente com excelência',30,'atendimentos',150);
  INSERT INTO premiacao_desabonos (politica_id,codigo,descricao,pontos) VALUES
   (p_politica_id,'030','Sinal fora do padrão',30),
   (p_politica_id,'031','Chamado repetitivo',30),
   (p_politica_id,'032','Uso indevido de porta da CTO',150),
   (p_politica_id,'033','Drop com emenda sem autorização',30),
   (p_politica_id,'034','Falta injustificada',50),
   (p_politica_id,'035','Perda de ferramentas',50),
   (p_politica_id,'036','Apresentação pessoal inadequada',30),
   (p_politica_id,'037','Interior do veículo inadequado',30),
   (p_politica_id,'038','Fumar dentro do veículo',50),
   (p_politica_id,'039','Não uso correto de EPIs',30);
END $$;

-- Competência anterior/seguinte helpers
CREATE OR REPLACE FUNCTION public.premiacao_comp_shift(p_comp text, p_delta int) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT to_char((to_date(p_comp || '-01','YYYY-MM-DD') + make_interval(months => p_delta))::date, 'YYYY-MM')
$$;

-- Apuração
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
    -- ajustes somam (positivo ou negativo) às medalhas
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
      v_prem := GREATEST(0, v_saldo - v_ref); v_valor := round(v_prem * pol.valor_ponto, 2); v_transp := 0; v_neg := 0;
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

CREATE OR REPLACE FUNCTION public.premiacao_fechar(p_politica_id uuid, p_competencia text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM premiacao_apuracoes WHERE politica_id=p_politica_id AND competencia < p_competencia AND status='aberta') THEN
    RAISE EXCEPTION 'Existe competência anterior em aberto. Feche-a antes.';
  END IF;
  PERFORM premiacao_apurar(p_politica_id, p_competencia);
  UPDATE premiacao_apuracoes SET status='fechada', fechado_por=auth.uid(), fechado_em=now()
   WHERE politica_id=p_politica_id AND competencia=p_competencia AND status='aberta';
  INSERT INTO premiacao_log (politica_id, entidade, acao, depois) VALUES (p_politica_id,'competencia','fechar',jsonb_build_object('competencia',p_competencia));
END $$;

CREATE OR REPLACE FUNCTION public.premiacao_marcar_exportada(p_politica_id uuid, p_competencia text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE premiacao_apuracoes SET status='exportada' WHERE politica_id=p_politica_id AND competencia=p_competencia AND status='fechada';
  INSERT INTO premiacao_log (politica_id, entidade, acao, depois) VALUES (p_politica_id,'competencia','exportar',jsonb_build_object('competencia',p_competencia));
END $$;

CREATE OR REPLACE FUNCTION public.premiacao_reabrir(p_politica_id uuid, p_competencia text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.is_admin_or_master(auth.uid()) THEN RAISE EXCEPTION 'Somente administradores podem reabrir competências.'; END IF;
  IF EXISTS (SELECT 1 FROM premiacao_apuracoes WHERE politica_id=p_politica_id AND competencia > p_competencia AND status<>'aberta') THEN
    RAISE EXCEPTION 'Há competências posteriores fechadas. Reabra-as primeiro.';
  END IF;
  UPDATE premiacao_apuracoes SET status='aberta', fechado_por=NULL, fechado_em=NULL WHERE politica_id=p_politica_id AND competencia=p_competencia;
  INSERT INTO premiacao_log (politica_id, entidade, acao, depois) VALUES (p_politica_id,'competencia','reabrir',jsonb_build_object('competencia',p_competencia));
  PERFORM premiacao_apurar(p_politica_id, p_competencia);
  FOR r IN SELECT DISTINCT competencia FROM premiacao_apuracoes WHERE politica_id=p_politica_id AND competencia > p_competencia ORDER BY competencia LOOP
    PERFORM premiacao_apurar(p_politica_id, r.competencia);
  END LOOP;
END $$;
