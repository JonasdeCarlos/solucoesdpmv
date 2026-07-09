## Objetivo

Adicionar suporte a uma política de prêmio mais complexa (modelo "Prêmio para Hotelaria"), com:

- Divisão **80% coletivo / 20% individual**
- Múltiplos critérios coletivos, cada um com **peso próprio sobre o faturamento** e **faixas Piso / Meta 0 / Meta 1 / Meta 2** com métrica-alvo específica
- **Distribuição por pontos** entre colaboradores (proporcional aos pontos atribuídos)
- Critérios individuais com escala 0 / 25 / 50 / 75 / 100 (Insatisfatório → Excelente)
- Salvar como **modelo pré-existente** disponível ao criar nova política

## Modelagem de dados (migração)

Estender `prize_policies` (JSONB, sem quebrar o que já existe):

- `modelo_template text` — ex.: `hotelaria`
- `rv_split_coletivo numeric` (default 80) / `rv_split_individual numeric` (default 20)
- `rv_criterios_coletivos jsonb` — lista de critérios coletivos:
  ```
  [{
    id, nome,                         // ex.: "Notas Booking"
    peso_pct: 10,                     // % sobre faturamento base
    metrica: "faturamento_direto" | "nota_media" | "pct_avaliacoes",
    canal: "booking"|"google"|"tripadvisor"|null,
    faixas: [
      { nivel:"piso",   pct:1.0, alvo:null },
      { nivel:"meta_0", pct:1.5, alvo:9.1 },
      { nivel:"meta_1", pct:2.0, alvo:9.2 },
      { nivel:"meta_2", pct:2.5, alvo:9.3 }
    ]
  }]
  ```
- `rv_distribuicao text` — `"pontos"` (novo) além de `individual`/`igualitario` já existentes
- `escala_avaliacao jsonb` — `[{label:"Excelente", valor:100}, ...]`

Nova tabela `prize_employee_points`:
```
id, policy_id, employee_id, pontos int, updated_at
```
+ GRANT authenticated + RLS por policy → client_id.

## Backend (edge function)

`premio-politica-seed-hotelaria` (opcional) ou seed direto no create:
Ao clicar em **"Usar modelo Prêmio para Hotelaria"** no diálogo de criação, o front:
1. Cria `prize_policies` com todos os campos pré-preenchidos (splits, critérios coletivos, escala, `modelo_template='hotelaria'`).
2. Insere os 4 critérios individuais (Postura, Eficiência, Pontualidade, Gestão Comercial) em `prize_criteria` com peso 5 cada e `descricao` contendo a lista de itens avaliados.

Sem chamada de IA — é um template determinístico salvo em `src/utils/sucessoCliente/premioTemplates.ts`.

## UI

**`PremioTab.tsx` — Diálogo "Nova Política"**
Adicionar botão "Usar modelo: Prêmio para Hotelaria" que preenche todos os campos e cria a política num clique.

**`PremioRemuneracaoVariavelSection.tsx`** (extensão)
Quando `modelo_template === 'hotelaria'` (ou split coletivo/individual habilitado), renderizar:
- Sliders 80/20 (coletivo/individual)
- Editor de critérios coletivos: nome, peso %, métrica, canal, tabela editável Piso/Meta0/Meta1/Meta2 (pct + alvo)
- Aba "Pontos por colaborador" (nova) — grid de colaboradores × input de pontos

**`PremioAplicacaoSection.tsx` — apuração**
Bloco de inputs manuais:
- Faturamento total, Meta 0/1/2 (valores globais)
- Vendas diretas do mês
- Avaliações por canal (lista com canal, nota, data → média calculada)
- Qtd de reservas (para % de avaliações)

Cálculo por critério coletivo:
```
BC_criterio = faturamento_total × peso_pct
nivel_atingido = maior faixa cuja métrica é atingida (ou piso)
valor_criterio = BC_criterio × faixa.pct
```
Distribuição individual (dentro de cada critério coletivo):
```
valor_colab = valor_criterio × (pontos_colab / soma_pontos)
```
Somar entre critérios para total coletivo por colaborador.
Parcela individual (20%) usa os critérios avaliados com escala 0/25/50/75/100.

## PDF da política

Estender `premioPoliticaPdf.ts` para renderizar:
- Bloco "Divisão Coletivo/Individual"
- Tabela por critério coletivo com faixas e alvos
- Escala de avaliação
- Tabela de pontos por colaborador (se preenchida)

## Arquivos

**Novos:**
- `supabase/migrations/…_prize_hotelaria.sql`
- `src/utils/sucessoCliente/premioTemplates.ts`

**Editar:**
- `src/hooks/usePrizePolicies.ts` (tipos + novo hook `useEmployeePoints`)
- `src/components/sucessoCliente/tabs/PremioTab.tsx` (botão modelo)
- `src/components/sucessoCliente/tabs/PremioRemuneracaoVariavelSection.tsx` (editor coletivos + pontos)
- `src/components/sucessoCliente/tabs/PremioAplicacaoSection.tsx` (apuração hotelaria)
- `src/utils/sucessoCliente/premioPoliticaPdf.ts` (novas seções)

## Fora do escopo (confirmar depois)

- Integração automática com Booking/Google/TripAdvisor APIs (por ora entrada manual das notas)
- Histórico de apurações com versionamento das metas
