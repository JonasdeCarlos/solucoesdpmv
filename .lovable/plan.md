# Módulo de Admissão — Fase 1

Construção faseada conforme aprovado. Esta fase entrega o ciclo completo: criar formulário → cliente preencher por link público → admin gerar dossiê PDF único.

## Modelo de acesso

- **Escritório (membro)**: protegido por senha única de escritório, configurada como secret (`OFFICE_PASSWORD`). O usuário digita a senha numa tela `/admissao/escritorio/login`; ao acertar, gravamos um flag em `localStorage` (`office_member=true`) que libera as rotas administrativas.
- **Cliente**: acessa `/admissao/preencher/:token` sem login. O token aleatório é gerado pelo admin ao criar a admissão e dá acesso apenas àquele preenchimento.
- **Restante do app**: continua público como hoje (sem mudanças).

Observação: como o app não tem auth Supabase, RLS continua "allow all". A proteção é por UI + token + senha de escritório. Para isolamento real seria preciso login (proposto para Fase 2/3).

## Estrutura de telas

```
/admissao                              redirect → /admissao/escritorio ou /preencher
/admissao/escritorio/login             tela de senha
/admissao/escritorio                   dashboard (lista de admissões + formulários)
/admissao/escritorio/formularios       construtor de templates (CRUD)
/admissao/escritorio/formularios/:id   editor do template
/admissao/escritorio/admissoes/nova    criar admissão (escolher template, empresa, gerar link)
/admissao/escritorio/admissoes/:id     detalhe (respostas, anexos, gerar dossiê)
/admissao/preencher/:token             formulário público p/ cliente
/admissao/preencher/:token/sucesso     confirmação de envio
```

Adicionar entrada no menu lateral: "Admissão" (visível só com flag office_member, senão mostra botão "Acesso do Escritório").

## Tipos de pergunta nesta fase

Texto curto, parágrafo, número, data, e-mail, telefone, CPF (com validação), CEP, dropdown, radio, checkbox, upload de arquivo. Tudo com flag obrigatório, descrição/ajuda, e (para radio/dropdown/checkbox) lista de alternativas reordenáveis.

Ficam para fases seguintes: escala linear, grade, assinatura, lógica condicional, versionamento, "Outra" com texto livre.

## Construtor de formulários

- Lista de templates publicados/rascunho.
- Editor com seções e perguntas, drag-and-drop via `@dnd-kit/core` (já leve).
- Cada pergunta tem `field_key` autogerado (slug), título, tipo, obrigatório, opções, e (para upload) formatos aceitos + tamanho máx + múltiplos arquivos.
- Botão "Pré-visualizar" abre o formulário em modo leitura.
- "Publicar" marca `is_published=true` e habilita criar admissões com esse template.

## Preenchimento pelo cliente

- Wizard por seções com barra de progresso.
- Validações em cada campo (zod por tipo).
- Uploads diretos para Storage bucket `admissao-uploads` (público=false), salvos em `requests/{request_id}/{field_key}/{uuid}.{ext}`.
- Auto-save de rascunho a cada 5s no `admission_requests.draft_answers`.
- Botão "Enviar" só ativa quando todos os obrigatórios estão preenchidos; muda status para `enviado` e congela edição (cliente).
- Página de sucesso com mensagem de confirmação.

## Geração do dossiê PDF

Gera **um único PDF** combinando:

1. **Capa** (jsPDF): título "Dossiê de Admissão", empresa+CNPJ, colaborador+CPF (extraídos das respostas se existirem campos com keys conhecidas), data de envio, nome+versão do formulário, índice dos anexos.
2. **Formulário preenchido** (jsPDF): renderiza seções e respostas; respostas vazias viram "Não informado".
3. **Anexos**:
   - PDFs: anexados diretamente via `pdf-lib`.
   - JPG/PNG/WEBP: convertidos para PDF (uma página por imagem) com `pdf-lib`.
   - HEIC/HEIF: convertidos para JPEG no navegador via biblioteca `heic2any`, depois para PDF.
   - Outros formatos: pulamos com aviso na capa "anexo não suportado".

Resultado salvo em Storage `admissao-dossies/{request_id}/dossie-{timestamp}.pdf` e referenciado em `admission_dossiers`. Botão de download e regenerar.

Nome do arquivo de download: `ADMISSAO - {nome} - {cpf} - {data}.pdf`.

## Banco de dados (migration)

Tabelas (RLS allow-all, condizente com o app):

- `admission_form_templates` — id, name, description, is_published, created_at, updated_at, schema_json (seções/perguntas).
- `admission_requests` — id, template_id, template_name_snapshot, company_name, company_cnpj, employee_name (opcional), token (único), status (`rascunho`|`enviado`|`em_analise`|`pendente`|`aprovado`|`concluido`|`cancelado`), draft_answers jsonb, answers jsonb, submitted_at, created_at, updated_at.
- `admission_files` — id, request_id, field_key, original_name, storage_path, mime_type, size_bytes, sort_order, uploaded_at.
- `admission_dossiers` — id, request_id, pdf_path, generated_at, file_name.

Buckets de storage:
- `admissao-uploads` (privado) — anexos do cliente.
- `admissao-dossies` (privado) — PDFs gerados.

Políticas: allow-all em ambos para alinhar com o restante do app.

## Senha do escritório

Secret `OFFICE_PASSWORD` adicionada via `secrets`. Edge function leve `office-auth` recebe a senha digitada e retorna OK/KO comparando com a env. Frontend guarda flag em localStorage por 12h.

## Dependências a instalar

- `@dnd-kit/core` e `@dnd-kit/sortable` — drag-and-drop do builder.
- `heic2any` — conversão HEIC→JPEG.
- `pdf-lib` (já existe), `jspdf` (já existe).

## Arquivos principais a criar

```
src/pages/admissao/
  EscritorioLoginPage.tsx
  EscritorioDashboardPage.tsx
  FormulariosListPage.tsx
  FormularioEditorPage.tsx
  AdmissaoNovaPage.tsx
  AdmissaoDetalhePage.tsx
  PreencherPage.tsx
  PreencherSucessoPage.tsx
src/components/admissao/
  builder/ (FieldEditor, SectionEditor, FieldTypePicker, OptionsEditor)
  preencher/ (FieldRenderer por tipo, FileUploadField, ProgressBar)
  detalhe/ (RespostasView, AnexosList, DossieActions)
src/utils/admissao/
  formSchema.ts (tipos TS do schema_json)
  validators.ts (CPF, email, etc.)
  imageToPdf.ts (HEIC + JPG/PNG/WEBP → PDF)
  dossieBuilder.ts (capa+form+anexos → PDF único)
  formPdf.ts (renderiza respostas em PDF)
src/hooks/
  useOfficeAuth.ts (flag localStorage + verificação)
  useAdmissaoTemplate.ts
  useAdmissaoRequest.ts
supabase/functions/office-auth/index.ts
supabase/migrations/{ts}_admissao.sql
```

`src/App.tsx` ganha as novas rotas; `AppLayout` ganha entrada de menu "Admissão" condicional.

## O que NÃO entra na Fase 1

- Versionamento de templates (editar publicado afeta novos envios; antigos guardam snapshot do nome).
- Lógica condicional (branching).
- Tipos: escala, grade, assinatura, "Outra" com texto.
- Comentários em thread, timeline detalhada, expiração automática, logs de auditoria estruturados.
- Solicitação granular de reenvio por documento.
- Auth real por usuário (Admin x Cliente isolado por empresa).

Esses entram nas Fases 2 e 3.

## Confirme para eu começar

Se aprovar, executo: criar migration + bucket → instalar deps → criar páginas/components/utils → testar fluxo end-to-end gerando um dossiê de exemplo.