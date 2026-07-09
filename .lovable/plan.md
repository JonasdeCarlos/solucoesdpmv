
# Reorganização da política Hotelaria

Objetivo: separar claramente o que é **estrutura da política** (perene) do que é **execução por mês** (competência). Hoje as abas misturam configuração, participantes e apuração em um único fluxo, e o botão de PDF vive numa seção genérica que exibe "Mês PDF" mesmo na configuração.

## Nova organização de abas (dentro da política Hotelaria)

```text
[ Configuração ]   [ Metas mensais ]   [ Apuração ]   [ Evolução diária ]
      |                   |                 |                  |
   estrutura         mês + pontos      por competência    por competência
   (perene)          + participantes   (seletor no topo)  (seletor no topo)
                     + PDF da política
```

### 1. Aba Configuração — só estrutura perene
- Mantém: split coletivo/individual, % distribuição do pool individual, critérios coletivos (nome, peso, métrica, faixas com %).
- **Remove daqui**: qualquer menção a competência, participantes, pontos e o botão "PDF da política".
- A seção `CriteriaSection` (critérios genéricos + botão PDF + seletor Mês PDF) e `EmployeesSection` (participantes) **não aparecem mais** quando o modelo é Hotelaria — elas seguem existindo só para políticas não-Hotelaria.

### 2. Aba Metas mensais — competência é o centro
Fica com tudo que é específico de um mês assinado:
- Seletor de competência (input `month`) + vigência + faturamento previsto.
- Meta 0/1/2 e observações do mês.
- Histórico de competências.
- **Colaboradores participantes** (a `EmployeesSection` inteira: adicionar manual, importar da empresa, colar lista, editar pontos) — porque pontos e participantes valem para a competência assinada.
- **Ao final da aba**: botão único **"Gerar PDF da política do mês {AAAA-MM}"**. O PDF sempre inclui a competência selecionada no topo (título) e na seção "Metas do mês". Sem PDF quando nenhuma competência foi cadastrada.

### 3. Aba Apuração — por competência
- **Seletor de competência no topo** (lista os meses já cadastrados em Metas mensais + "Novo…" para criar).
- Ao trocar a competência: carrega/salva `hotelaria_apuracao[competencia]` (o campo passa a ser um mapa `{ 'AAAA-MM': ApuracaoState }` em vez de um objeto único).
- Meta 0/1/2 vêm pré-preenchidas da competência selecionada (ainda editáveis).
- Cálculos e distribuição por colaborador exatamente como hoje, mas escopados ao mês.

### 4. Aba Evolução diária — por competência
- Mesmo seletor de competência (sincronizado com Apuração).
- Usa a `ApuracaoState` daquela competência.
- Data referência e dias do período respeitam o mês selecionado (defaults: dia atual se mês corrente; senão último dia do mês / dias do mês).

## Detalhes técnicos

- `HotelariaConfig` já tem `metas_mensais: Record<string, MetaMensal>` — reaproveita como fonte da lista de competências.
- Novo campo `hotelaria_apuracoes: Record<string, ApuracaoState>` em `PrizePolicy` (JSONB, sem migração de schema — já usa colunas JSON existentes). Migração leve em runtime: se só existir `hotelaria_apuracao` (objeto único legado), migra para a competência atual na primeira leitura.
- `PremioTab.tsx` (`PolicyCard`): quando `isHotelaria`, **não renderiza** `CriteriaSection` nem `EmployeesSection` (elas passam a viver dentro da aba Metas mensais). Continua renderizando `PremioAplicacaoSection` (avaliações individuais) abaixo — ou movemos também? Proposta: manter `PremioAplicacaoSection` fora das abas, pois ela é o fluxo de avaliação individual do prêmio já apurado.
- Botão PDF migra para o rodapé de `MetasMensaisPanel`, recebendo `onExportPdf(mes)` do pai; toda a lógica de montagem do payload (participantes + pontos + hotelaria + metas_mes) fica no pai, que já tem acesso a `cliente` e `items` de critérios (nesse modelo, os "critérios" no PDF vêm de `HOTELARIA_CRITERIOS_INDIVIDUAIS` — não precisa mais depender de `prize_criteria`).
- PDF (`premioPoliticaPdf.ts`): já mostra a competência na seção "METAS DO MÊS". Adiciono também no **título** ("POLÍTICA DE PRÊMIO — COMPETÊNCIA MM/AAAA") quando `metas_mes` estiver presente, e no nome do arquivo (`politica-Premio-hotelaria-2026-07.pdf`).

## Arquivos afetados

- `src/components/sucessoCliente/tabs/PremioHotelariaSection.tsx` — reorganizar abas, adicionar seletor de competência em Apuração/Evolução, embutir participantes + botão PDF em Metas mensais, migrar estrutura `hotelaria_apuracoes`.
- `src/components/sucessoCliente/tabs/PremioTab.tsx` — esconder `CriteriaSection`/`EmployeesSection` quando Hotelaria; expor callback de export de PDF para a seção Hotelaria.
- `src/utils/sucessoCliente/premioPoliticaPdf.ts` — competência no header/título e no nome do arquivo.
- `src/utils/sucessoCliente/premioTemplates.ts` — tipar `hotelaria_apuracoes` (documentação).

## Fora de escopo

- Não mexer em políticas não-Hotelaria (fluxo antigo intacto).
- Não migrar dados no banco — migração em runtime é suficiente (mapa vazio ⇒ usa `hotelaria_apuracao` legado como competência atual).
- Não alterar cálculos de prêmio (já validados).

Confirma que a divisão faz sentido? Em especial:
1. **Participantes** ficam mesmo dentro de "Metas mensais" (assumindo que a lista pode variar mês a mês) — ou preferes uma aba separada "Participantes"?
2. `PremioAplicacaoSection` (avaliações individuais dos colaboradores para pagar o prêmio) — mantenho abaixo das abas ou movo para dentro de "Apuração" filtrada por competência?
