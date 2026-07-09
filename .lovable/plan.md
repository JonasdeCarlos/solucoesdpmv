## Objetivo
Transformar o link público `/politica-hotelaria/:policyId` (hoje só resumo + PDF) em uma versão espelhada da tela interna "Prêmio para Hotelaria" para o gestor de RH da pousada, sem login, com todas as 4 abas + avaliação individual.

## Abas expostas no link público
1. **Configuração** — leitura + edição (split, critérios coletivos, faixas, escala individual).
2. **Metas mensais** — leitura + edição (metas 0/1/2 por competência, observações).
3. **Apuração** — leitura + edição (faturamento, dia de referência, dias do período, avaliações por canal, cálculo coletivo).
4. **Evolução diária** — painel projetado (leitura, calculado da apuração).
5. **Avaliação individual** — a pousada preenche os critérios individuais de cada funcionário (o mesmo formulário que o escritório usa).

Nada de autenticação. O `policyId` da URL é o segredo do link.

## Estratégia técnica
Reaproveitar os componentes internos `PremioHotelariaSection` e `PremioAplicacaoSection` (já contêm toda a UI) e injetar uma camada de dados pública que substitui os hooks/Supabase-direto por chamadas à edge function `premio-hotelaria-public`.

### 1. Edge function `premio-hotelaria-public` (expandir)
Hoje só faz `GET`. Adicionar operações de escrita autenticadas apenas pelo `policy_id` da URL:
- `action: 'get'` (atual) → devolve policy, config, cliente, employees (com pontos), criteria, apurações.
- `action: 'update_config'` → grava `hotelaria_config`.
- `action: 'update_apuracao'` → grava `hotelaria_apuracoes[competencia]`.
- `action: 'update_meta_mes'` → grava `hotelaria_config.metas_mensais[competencia]`.
- `action: 'save_assessment'` → cria/atualiza `prize_assessments` + `prize_assessment_employees` + `prize_assessment_criterion_results` para uma competência.
- `action: 'close_assessment'` / `'reopen_assessment'` → alterna status.

Todas usam service-role internamente, mas ficam limitadas ao `policy_id` recebido. Validação com Zod. Sem exposição de outras políticas/clientes.

### 2. Página pública `PoliticaHotelariaPublicPage`
Rescrever para:
- Buscar dados via edge function.
- Renderizar `<PremioHotelariaSection policy={...} cliente={...} onUpdate={...} />` passando um `onUpdate` que chama a edge function ao invés de gravar direto no Supabase.
- Passar um contexto (via prop nova `publicMode` + `publicApi`) que os componentes internos usam para: (a) desabilitar botões que não fazem sentido (ex.: gerar link público, exportar Domínio), (b) trocar chamadas diretas ao Supabase por chamadas ao `publicApi`.

### 3. Ajustes nos componentes internos
- `PremioHotelariaSection` — nova prop opcional `publicApi?: { updateConfig; updateApuracao; updateMeta; listEmployees; listCriteria; }`. Quando presente:
  - substitui `usePrizeEmployees` / `usePrizeCriteria` por dados já vindos das props;
  - esconde o botão "Copiar link público" e outras ações de escritório.
- `PremioAplicacaoSection` — nova prop opcional `publicApi?: { saveAssessment; closeAssessment; reopenAssessment; }`. Quando presente, usa a API em vez do Supabase.

### 4. Segurança
- `policyId` funciona como token (mesmo padrão já aprovado para feedback público e link atual).
- Edge function valida a existência do `policyId` e valida payloads com Zod (limites de tamanho, tipos numéricos, competência `YYYY-MM`).
- Nenhum outro `policy_id` é vazado; consultas sempre filtram pelo id recebido.
- Grava um `updated_at` para auditoria.

## Arquivos afetados
- `supabase/functions/premio-hotelaria-public/index.ts` (expandir).
- `src/pages/sucessoCliente/PoliticaHotelariaPublicPage.tsx` (rescrever).
- `src/components/sucessoCliente/tabs/PremioHotelariaSection.tsx` (aceitar `publicApi`).
- `src/components/sucessoCliente/tabs/PremioAplicacaoSection.tsx` (aceitar `publicApi`).

## Fora do escopo
- Nenhum backend de autenticação/OTP.
- Configurações fora de "Prêmio para Hotelaria" (não expõe outras políticas).
- Reescrita visual — mantém o layout já existente da tela interna.

Confirma pra eu implementar?