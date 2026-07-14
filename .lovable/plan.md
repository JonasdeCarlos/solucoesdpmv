# Fase 3 — Revisão, vinculação e replicação

Duas frentes independentes, entregues juntas: revisão editável do Raio-X e gestão dos clientes vinculados à análise.

## 1) Revisão editável do Raio-X (`/gestao-cct/:id/revisar`)

Substituir a página placeholder por uma tela funcional.

- Layout em duas colunas: à esquerda, o visualizador do PDF principal (mesmo padrão dos módulos existentes com `embed application/pdf`), à direita a lista de blocos A–N.
- Cada bloco (identificação, sindicatos, base territorial, cláusulas econômicas, benefícios, jornada, HE/adicionais, férias, admissão/rescisão, obrigações sindicais, saúde/segurança, multas, pontos de atenção) exibe seus campos como formulários editáveis:
  - Campos texto simples → `Input`/`Textarea`.
  - Objetos/arrays (ex: pisos salariais, benefícios, multas) → mini-tabelas com adicionar/remover linha.
  - Cada bloco mostra confiança (Alto/Médio/Baixo) e trecho de origem quando presente.
- Ações por bloco: **Confirmar**, **Editar**, **Ignorar** (marca como não aplicável) e **Marcar para revisão**. O estado por bloco fica em `reviewer_notes` (JSON estruturado) e o campo `status` da análise passa de `revisar` → `aprovada` quando todos os blocos são confirmados.
- Campo geral de "Notas do revisor" (texto livre).
- Botões no topo: Salvar rascunho / Aprovar análise / Cancelar. Aprovar grava `reviewed_by`, `reviewed_at`, status `aprovada` e registra `cct_audit_log` (`review_approved`).

## 2) Vinculação e replicação a clientes

Novo card na página de detalhe (`CctDetailPage`) — "Clientes vinculados" — mostrando os registros de `cct_client_links` + `client_ccts.cct_analysis_id`.

- Lista clientes já vinculados com status (ativo/substituído), data e responsável.
- Botão **Vincular clientes**: modal com busca em `clientes` (nome/CNPJ), filtros rápidos por UF, base sindical (comparando com `unions.sindicato_laboral` extraído) e CNAE. Multi-seleção com "selecionar todos filtrados".
- Ao vincular:
  - Se o cliente já tem `client_ccts` ativa diferente → perguntar: "manter ambas / arquivar anterior / cancelar" (arquivar = `is_active=false` + snapshot em `cct_versions`).
  - Cria linha em `cct_client_links` (status `ativo`) e um `client_ccts` novo apontando para `cct_analysis_id`, herdando os metadados essenciais do Raio-X (sindicatos, vigência, data-base).
- Botão **Desvincular** por linha: seta `unlinked_at` + status `removido`.
- Toda ação de vínculo/desvínculo/substituição grava linha em `cct_audit_log` com metadata (client_id, ação, motivo).

## Detalhes técnicos

- Nenhuma migração nova nesta fase — colunas necessárias já existem em `cct_analyses`, `cct_client_links`, `client_ccts`, `cct_audit_log`.
- Novo hook `useCctClientLinks(analysisId)` para list/create/remove com `reload()`.
- Novo componente `CctReviewBlock` genérico (recebe `label`, `data`, `schema`, `onChange`, `onConfirm`, `onIgnore`) reutilizado em todos os blocos A–N.
- Reutilizar `RenderObject/RenderValue` do detalhe apenas em modo leitura; a edição usa formulários controlados.
- Persistência de rascunhos: os blocos editados salvam direto nas colunas JSONB da própria `cct_analyses` (não duplicamos em `cct_clauses`/`cct_benefits` nesta fase — sincronização de `cct_benefits` continua no fluxo da IA).

## Fase 4 (entregue)

- PDF técnico completo do Raio-X (`src/utils/gestaoCct/raioXTecnicoPdf.ts`) com identidade visual e todos os blocos A–N + notas do revisor.
- Botão "PDF Raio-X técnico" no `CctDetailPage` (além do PDF de resumo para cliente).
- Motor de alertas automáticos: edge function `cct-alerts-refresh` gera linhas em `cct_alerts` a partir de `client_ccts` (vencendo em 30d/90d, vencidas, sem vigência).
- Hook `useCctAlerts` + card "Alertas abertos" no dashboard com botão "Recalcular", severidade, atalho para a análise e resolver.

## Fase 5 (entregue)

- Edge function `cct-ask` consulta o Raio-X JSON + trecho de OCR na `cct_analyses` e responde via Lovable AI (Gemini 2.5 Flash) com system prompt anti-alucinação.
- `CctAskPage` funcional: sugestões prontas, chat com histórico, badges de status, integração com `logCctAudit` (`ask_question`).
- Versionamento: hook `useCctVersions` + componente `CctVersionsCard` no detalhe permitem "Salvar versão" (snapshot com motivo → `cct_versions`) e listar histórico.
