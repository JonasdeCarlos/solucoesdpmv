# Plano — Gestão de CCT (Convenções Coletivas)

Evolução do que já existe em **Sucesso do Cliente – DP** (tabela `client_ccts`, hook `useCcts`, página `GestaoCctPage`, edge functions `ai-buscar-cct`, `ai-resumo-cct`, `ai-extract-rubricas`, `cct-aviso-vencimento`) para um módulo completo, **sem duplicar dados**. A `client_ccts` continua sendo a fonte única; expandimos com novas tabelas satélites para Raio-X, cláusulas, benefícios, alertas, versões e logs.

Dado o tamanho do escopo (17 seções), vou entregar em **5 fases sequenciais**, cada uma testável de forma isolada. Aqui está o plano geral; ao final peço aprovação e começo pela Fase 1.

---

## Fase 1 — Fundação de dados + nova aba

**Migrações (usando `client_ccts` como raiz, sem duplicar):**
- `cct_analyses` — Raio-X estruturado (1:1 com `client_ccts`, JSONB por bloco: identificação, sindicatos, base territorial, categorias, econômicas, jornada, adicionais, férias/afastamentos, admissão/rescisão, sindicais, saúde/segurança, multas, pontos de atenção DP). Campos: `confidence_score`, `reviewed_by`, `reviewed_at`, `status` (em_analise/revisar/aprovada), `ocr_text`, `ai_version`.
- `cct_clauses` — cláusulas extraídas item-a-item (`title`, `type`, `extracted_text`, `summary`, `page_number`, `confidence`, `status`, `source_snippet`).
- `cct_benefits` — benefícios obrigatórios normalizados (nome, valor, periodicidade, elegíveis, condições, desconto permitido, prazo, penalidade).
- `cct_client_links` — replicações multi-cliente (já parcialmente coberto por `client_ccts.client_id`; nova tabela permite N clientes por análise sem duplicar linhas).
- `cct_alerts` — alertas de vencimento/data-base/reajuste/benefício pendente.
- `cct_reports` — histórico de PDFs e mensagens WhatsApp gerados.
- `cct_audit_log` — quem fez o quê (upload, OCR, revisão, vinculação, replicação, export).
- `cct_versions` — snapshot ao substituir CCT (arquivo original + Raio-X anterior).

Todas com GRANTs (`authenticated`, `service_role`), RLS via `is_admin_or_master` / `has_role`, `updated_at` trigger.

**Bucket Storage:** reusar `premio-docs`? Não — criar `cct-docs` (privado) para PDFs/imagens de CCT + PDFs de Raio-X gerados.

**Nova aba de menu:** já existe rota `/sucesso-cliente/gestao-cct`. Promover para item de menu top-level "Gestão de CCT" em `AppLayout`, mantendo a rota atual como redirect. Nova estrutura de páginas:
```
/gestao-cct                    → dashboard + lista
/gestao-cct/nova               → upload
/gestao-cct/:id                → detalhe (Raio-X + cláusulas + benefícios + clientes vinculados + versões)
/gestao-cct/:id/revisar        → tela de revisão item-a-item
/gestao-cct/:id/perguntar      → chat "Perguntar à CCT"
```

## Fase 2 — Upload, OCR e extração IA (Raio-X)

- Componente `CctUploadWizard` com progresso (Upload → OCR → Leitura → Extração → Raio-X → Revisão).
- Edge function nova `cct-ocr-extract` — recebe path do arquivo em `cct-docs`, detecta se PDF é pesquisável (via `pdfjs`), se não faz OCR (Gemini 2.5 Flash com imagens das páginas) para gerar `ocr_text`.
- Edge function nova `cct-raio-x` — recebe `ocr_text`, chama Gemini 2.5 Pro com prompt estruturado para preencher todos os blocos A–N do Raio-X, retornando JSON validado por Zod, com `confidence` por campo e `source_snippet` + `page_number` quando possível. Regra: nunca inventar — `"Não identificado no documento"` quando ausente.
- Reaproveitar `ai-resumo-cct` e `ai-extract-rubricas` já existentes para complementos.

## Fase 3 — Revisão, vinculação e replicação

- Página `CctReviewPage`: cada campo do Raio-X editável, com trecho de origem, página, confiança (Alto/Médio/Baixo) e ações Confirmar/Editar/Ignorar/Revisar.
- `CctClientLinks` component — vincular manual, em lote (filtro por sindicato/base/UF/CNAE), desvincular, substituir CCT anterior (com opção "manter ambas / arquivar anterior / cancelar").
- Evoluir a replicação já existente com log em `cct_audit_log`.

## Fase 4 — Alertas, resumo cliente, PDFs, dashboard

- Job de alertas (cron edge function existente `cct-aviso-vencimento` — expandir para gerar linhas em `cct_alerts` para 90/60/30d, vencida, data-base, reajuste pendente, benefício pendente, cliente sem CCT, CCT sem revisão).
- Dashboard: KPIs + gráficos (recharts) por vencimento, sindicato, base sindical, benefícios recorrentes, alertas por tipo.
- Botão "Gerar Resumo para Cliente" → texto amigável editável + template WhatsApp + PDF resumo.
- Botão "Gerar PDF – Raio-X" → PDF A4 com logo/cores do escritório (`office_branding`), capa, sumário, todos os blocos, tabelas de pisos/reajustes/adicionais, alertas.

## Fase 5 — Integrações + Busca IA + Versionamento

- **Perfil do cliente (`SucessoClienteProfilePage`):** aba CCT já existe; exibir Raio-X resumido, alertas, link para módulo completo, e permitir vincular sem sair do perfil. Sincronização é natural pois a base é única.
- **Rubricas:** botão "Sugerir rubricas a partir da CCT" que reusa `ai-extract-rubricas` e insere em `client_rubrics`.
- **Checklist fechamento:** adicionar steps automáticos ao `closing_checklist_runs` quando cliente tem CCT vigente.
- **Calendário do cliente:** criar `client_calendar_events` para vencimento/data-base/reajuste.
- **Módulo de Feriados:** botão "Enviar dias especiais da CCT ao calendário de feriados".
- **"Perguntar à CCT":** edge function `cct-ask` — recebe pergunta + `analysis_id`, faz RAG simples sobre `ocr_text` com Gemini, retorna resposta + trecho + página, ou "Não localizado na CCT analisada."
- **Versionamento:** snapshot em `cct_versions` ao substituir; comparação lado-a-lado destacando mudanças relevantes.

---

## Detalhes técnicos

- **Stack:** React + Vite + shadcn (já em uso). Sem novas dependências além de `pdfjs-dist` (para detectar PDF pesquisável) e reuso de `jspdf`/`jspdf-autotable` (já usados em `premioPoliticaPdf.ts`).
- **IA:** Lovable AI Gateway com `google/gemini-2.5-pro` para Raio-X (qualidade), `google/gemini-2.5-flash` para OCR e busca.
- **Segurança:** todas as edge functions com `verify_jwt` (padrão), validação Zod, RLS scoped por `has_role('admin'|'master'|'user_dp')`.
- **Anti-duplicidade:** `client_ccts` continua sendo a linha-mestre (1 por vínculo cliente↔CCT). `cct_analyses` é 1:1 com um "documento" lógico; múltiplos `client_ccts` podem apontar para a mesma `cct_analysis_id` via nova coluna FK, evitando reprocessar o mesmo PDF para clientes da mesma base.

## O que peço para começar

Confirmação para iniciar pela **Fase 1** (migrações + promoção da aba no menu + esqueleto das novas rotas). Cada fase seguinte só começa após validação da anterior.
