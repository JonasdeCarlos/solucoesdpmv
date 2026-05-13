## Módulo: Gestão de Avisos ao Cliente (PDF → Avisos → WhatsApp)

Vou adicionar um novo módulo dentro da área **Escritório** (mesma área de Admissão, sem login de usuário individual — segue padrão público do projeto), acessível pelo menu lateral existente.

### 1. Backend (Lovable Cloud)

**Tabelas novas:**
- `aviso_empresas` — code, name, cnpj, ativo
- `aviso_imports` — file_path, file_name, imported_at, total_rows, novos, ignorados, errors_json, emission_date, emission_time
- `avisos` — empresa_id (fk lógica), employee_code, employee_name, motivo (categoria normalizada), motivo_original, due_date, limit_date, source_emission_date, import_id, status (`sem_retorno|aberto|em_tratamento|concluido`), unique_hash (única), aviso1_at/by, aviso2_at/by, aviso3_at/by, no_response_at/by, observacoes
- `aviso_contact_attempts` — aviso_id, attempt_type (`aviso1|aviso2|aviso3|no_response|call`), marked_at, marked_by, call_date, call_channel, notes
- Bucket storage `aviso-pdfs` (privado)
- RLS pública (como o resto do app — sem auth de usuário)
- Index único em `avisos.unique_hash`

**Edge function `parse-aviso-pdf`:**
- Recebe `file_path` no bucket
- Baixa PDF, converte páginas em imagens, manda para Gemini 2.5 Flash (Lovable AI) com prompt estruturado pedindo JSON: `{emission_date, empresas:[{code,name,cnpj,linhas:[{employee_code,employee_name,motivo,vencimento_raw}]}]}`
- Retorna o JSON parseado para o frontend processar dedupe + insert

### 2. Lógica de dedupe

`unique_hash = sha256(cnpj | empresa_code | employee_code | employee_name_norm | motivo_categoria | due_date | limit_date)`

Ao importar:
- Se hash existe e status ≠ `concluido` → ignorar
- Se hash existe mas concluído há mais de N dias (config = 30) → criar novo
- Mudança de data ou motivo gera hash diferente → novo aviso

Normalização: trim, uppercase, remoção de acentos, colapso de espaços. Categorização do motivo por matching de substring (mapa fixo das 9 categorias + "Outros").

### 3. Frontend — rotas dentro de `/admissao/escritorio` (nova aba "Avisos")

Adicionar abas no `EscritorioLayout`:
- `/admissao/escritorio/avisos` — lista de avisos (gestão) — tela principal
- `/admissao/escritorio/avisos/import` — upload PDF + log de importações
- `/admissao/escritorio/avisos/empresas` — lista de empresas detectadas
- `/admissao/escritorio/avisos/:id` — detalhe do aviso

**Tela Avisos (gestão):**
- Filtros: empresa, CNPJ, período vencimento (de/até), período importação, motivo, status
- Tabela com colunas pedidas; cada linha tem botões: Copiar mensagem, Aviso 1/2/3 (badges com timestamp ao marcar), Cliente sem retorno, Ligação realizada (abre dialog), dropdown status
- Badge visual quando status = `sem_retorno`

**Tela Detalhe:**
- Dados completos, mensagem padrão pré-renderizada, histórico (`aviso_contact_attempts`), observações, todas as ações

**Tela Import:**
- Upload de PDF (mesmo padrão `FileDropZone`)
- Após processar, mostra: total empresas, total linhas, novos inseridos, repetidos ignorados
- Lista de imports anteriores com botão "ver log"

**Tela Empresas:**
- Lista com filtro por code/nome/CNPJ
- Click → filtra a tela de Avisos pela empresa

### 4. Mensagem WhatsApp

Template fixo:
```
Prezado(a) Cliente, se atente para os avisos de vencimento a seguir:

- {EMPREGADO} — {MOTIVO} — {DATA_VENC}{ se limite: . Limite: {DATA_LIMITE}}.

Contate-nos para que possamos dar o tratamento necessário, evitando o pagamento de encargos desnecessários.
```

Botão "Copiar mensagem" usa `navigator.clipboard.writeText` + toast.

### 5. Identidade do "usuário"

Como o app não tem auth individual no escritório (só senha compartilhada), o campo `marked_by` será preenchido com um nome digitado uma única vez e salvo no `localStorage` (`office_operator_name`). Se vazio, abre prompt no primeiro clique de marcação.

### 6. Navegação

Adicionar tab "Avisos" no `EscritorioLayout.tsx` ao lado de Admissões/Formulários/Arquivo, com badge da contagem de avisos `sem_retorno`+`aberto`.

### Arquivos novos principais
- `supabase/functions/parse-aviso-pdf/index.ts`
- `src/hooks/useAvisos.ts`, `src/hooks/useAvisoEmpresas.ts`, `src/hooks/useAvisoImports.ts`
- `src/utils/avisos/normalize.ts` (hash, categoria, parse de "DD/MM/YYYY - Limite DD/MM/YYYY")
- `src/utils/avisos/whatsappMessage.ts`
- `src/pages/avisos/AvisosListPage.tsx`, `AvisoDetailPage.tsx`, `AvisosImportPage.tsx`, `AvisoEmpresasPage.tsx`
- Migration SQL com tabelas + bucket + RLS

Pronto pra eu codificar tudo isso?