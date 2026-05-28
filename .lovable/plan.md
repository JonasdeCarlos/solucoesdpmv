## Módulo de Feriados e Comunicados

Vou criar um módulo completo acessível em `/feriados-comunicados` no menu lateral.

### 1. Banco de Dados (migrations)

Novas tabelas:
- `office_branding` — logo, cores primária/secundária, nome do escritório, contatos (JSON). Linha única.
- `ccts` — id, nome, sindicato, uf, vigência início/fim.
- `holidays` — data, nome, tipo (enum: distrital/municipal/estadual/sindical/ponto_facultativo/interno), é_feriado, é_ponto_facultativo, escopo (todos/uf/municipio/empresa/cct), uf, municipio, company_id, cct_id, fonte (auto/manual/decreto/cct), source_doc_id, status (ativo/inativo), observações, vigência.
- `holiday_source_documents` — tipo (decreto_municipal/estadual/cct/outro), uf, municipio, cct_id, file_path (Storage bucket `feriados-docs`), ano, extraction_json, status, importado_por/em.
- `holiday_extraction_items` — source_doc_id, data, nome, tipo, é_feriado, é_ponto_facultativo, confiança, evidência (trecho), status (pendente/confirmado/ignorado).
- `holiday_notices` — título, corpo (template com placeholders), audience_json (filtros), status (rascunho/publicado/arquivado), datas relacionadas.
- `holiday_notice_exports` — notice_id, pdf_path, whatsapp_text, exportado_em/por.
- `holiday_audit_log` — entidade, ação, antes/depois (JSON), usuário, timestamp.

Reaproveito `feriados_municipais` existente como fonte da “base automática” pré-cadastrada — uma seed function clona registros pertinentes em `holidays` quando a empresa é cadastrada (gatilho ou ação manual “Carregar base municipal”).

Bucket Storage: `feriados-docs` (privado), `office-assets` (público p/ logo).

RLS: full access autenticado (mesmo padrão dos outros módulos do app).

### 2. Edge Function de extração com IA

`supabase/functions/extract-holidays-doc/index.ts`:
- Recebe `source_doc_id`, baixa o PDF do Storage, extrai texto (pdf parse).
- Chama Lovable AI (Gemini 2.5 Flash) com prompt estruturado pedindo JSON: lista de feriados detectados com data, nome, tipo, escopo, é_ponto_facultativo, confiança 0–1, trecho de evidência.
- Salva itens em `holiday_extraction_items` com status `pendente`.
- Confiança < 0.7 sempre fica pendente; nada é publicado direto.

### 3. Frontend — páginas

Rota base `/feriados-comunicados` com sub-abas:

**a) Calendário** (`HolidaysCalendarTab.tsx`)
- Visão mensal/anual em grid, cores por tipo (configuráveis), legenda e filtros (município, UF, CCT, empresa, tipo).

**b) Lista de Feriados** (`HolidaysListTab.tsx`)
- Tabela com data, nome, tipo, escopo, fonte, status. Ações: editar, desativar, gerar comunicado.
- Dialog “Adicionar feriado” com todos os campos especificados.
- Importação CSV/XLSX.

**c) Importar Decreto/CCT** (`HolidaysImportTab.tsx`)
- Upload PDF/DOC + metadados (tipo, UF, município, CCT, ano).
- Botão “Processar” → chama edge function.
- Tela de revisão: itens sugeridos com confiança %, evidência, ações “Confirmar/Editar/Ignorar”. Dedupe por chave `(data + tipo + escopo + município/UF/CCT + nome normalizado)`.

**d) Comunicados** (`NoticesTab.tsx`)
- Criar comunicado a partir de 1 feriado, vários feriados ou de uma importação.
- Editor com placeholders (`{{data}}`, `{{dia_semana}}`, `{{municipio}}`, `{{uf}}`, `{{nome_evento}}`, `{{tipo_evento}}`, `{{observacao_curta}}`, `{{nome_escritorio}}`).
- Segmentação de público (Todos/Município/UF/CCT/Empresa).
- Filtros completos (público, tipo, datas, status, município, CCT).
- Ações por comunicado:
  - **Copiar para WhatsApp** (texto formatado pelos placeholders resolvidos)
  - **Copiar como texto**
  - **Gerar PDF** (jsPDF) com logo + faixa de cor primária, título, corpo, rodapé com contatos do escritório, A4.
- Exportação em lote: lista de mensagens WhatsApp por feriado/empresa/município.

**e) Configurações / Branding** (`OfficeBrandingTab.tsx`)
- Upload de logo (bucket `office-assets`), cor primária/secundária (color picker), nome do escritório e contatos. Pré-visualização do cabeçalho do PDF.

**f) Logs & Auditoria** (`HolidaysAuditTab.tsx`)
- Tabela de importações (arquivo, totais, confirmados/ignorados/duplicados/pendentes).
- Histórico de alterações (antes/depois).

### 4. Utilitários
- `src/utils/holidays/noticePdf.ts` — gera PDF com branding usando jsPDF (mesmo padrão dos outros geradores do app).
- `src/utils/holidays/whatsappText.ts` — resolve placeholders.
- `src/utils/holidays/dedupe.ts` — chave única normalizada.
- `src/utils/holidays/csvImport.ts` — parser CSV/XLSX.
- Hooks `useHolidays`, `useNotices`, `useOfficeBranding`, `useHolidaySources`.

### 5. Integração no app
- Novo item de menu “Feriados” em `src/components/AppLayout.tsx`.
- Rota em `src/App.tsx` protegida por `ProtectedRoute`.
- Auto-seed: ao carregar a página, oferece botão “Importar base municipal padrão” que copia `feriados_municipais` ativos para `holidays` do escopo informado.

### Observações
- Tudo em pt-BR, paleta Monte Verde já existente no app.
- A IA usa o gateway nativo (sem API key adicional).
- Comunicados nunca publicam item da IA sem confirmação manual.
- Escopo grande: vou implementar tudo em uma única passada com hooks e telas básicas funcionais, sem deixar TODOs.

Posso prosseguir?
