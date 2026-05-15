## Módulo "Banco de Horas" — Plano de Implementação

### Visão geral
Novo módulo no menu principal para subir PDFs mensais de Cartão Ponto (Secullum), extrair o saldo BSALDO de cada colaborador, armazenar histórico por competência e exibir dashboard com filtros, faixas de cor, tendência e relatórios.

### Fluxo de extração (validado no PDF de exemplo)
PDF tem 1 colaborador por página. Por página:
- **Período** → cabeçalho `Período: dd/mm/aaaa até dd/mm/aaaa` → competência `YYYY-MM` (mês de início).
- **Empresa** → linha após `EMPRESA:` + `CNPJ:`.
- **Colaborador** → linha após `NOME:` + `Nº FOLHA:` (código).
- **BSALDO** → linha `TOTAIS`, coluna `BSALDO` (8ª coluna numérica). Sinal +/- preservado (ex.: `-83:03`, `+12:30`, `00:00`).
- Se não achar BSALDO → marca como **pendente**.

A extração roda **server-side** numa edge function (`parse-ponto-pdf`) com `pdf-parse`/`pdfjs` para preservar o layout textual, depois regex linha-a-linha.

### Banco de dados (migration)
Tabelas novas (RLS: `authenticated full access`):
- `bh_imports` — id, empresa_nome, empresa_cnpj, competencia (date 1º dia), file_path, file_hash, imported_at, imported_by, total_paginas, total_ok, total_pendentes, errors_json.
- `bh_employees` — id, empresa_cnpj, codigo, nome (UNIQUE empresa_cnpj+codigo).
- `bh_balances` — id, import_id, employee_id, empresa_cnpj, competencia (date), balance_minutes (int, com sinal), balance_hhmm (text), version, created_at. UNIQUE(employee_id, competencia, version).
- `bh_settings` — id, scope (`global`|`empresa`|`colaborador`), empresa_cnpj nullable, employee_id nullable, daily_minutes int. (Default global = 480.)

Bucket `ponto-pdfs` (privado) para arquivar os PDFs originais.

### Edge function
`supabase/functions/parse-ponto-pdf/index.ts`
- Recebe `{ file_path }` (PDF já no bucket) ou base64.
- Roda `pdfjs-dist` em Deno → texto com layout.
- Regex de extração por página → array `{ empresa_nome, empresa_cnpj, codigo, nome, competencia, bsaldo, status }`.
- Retorna JSON; o front decide gravar (com escolha em caso de duplicidade).

### Telas (rotas dentro de `/banco-horas`)
1. **`/banco-horas`** — Dashboard (default).
   - Filtros: empresa, período (competência inicial/final), colaborador, faixa, sinal.
   - KPIs: total colaboradores, saldo consolidado, % por faixa, top 10 +, top 10 −.
   - Gráficos (recharts): evolução total, evolução por colaborador, distribuição empilhada por faixa.
   - Indicadores de tendência ↑→↓ (delta vs mês anterior, threshold configurável padrão 60 min).
2. **`/banco-horas/importar`** — Upload de PDFs, prévia da extração, resolução de duplicatas (substituir / manter / nova versão), resumo final.
3. **`/banco-horas/colaboradores`** — Lista por competência selecionada com saldo HH:MM, dias, faixa, tendência. Click → detalhe do colaborador (série temporal + tabela mês a mês).
4. **`/banco-horas/parametros`** — Carga diária global, por empresa, por colaborador. Threshold de tendência.
5. **`/banco-horas/auditoria`** — Lista de importações, quem importou, quando, totais, link para PDF.

### Lógica auxiliar (`src/utils/bancoHoras/`)
- `parseHHMM(str) → minutos com sinal`
- `formatHHMM(min) → string com sinal`
- `classifyFaixa(min) → 'verde'|'amarelo'|'laranja'|'vermelho'` (baseado em |min|: <16h, <31h, <51h, ≥51h).
- `toDays(min, dailyMin) → number`
- `trend(curr, prev, threshold) → 'alta'|'queda'|'estavel'`
- `exportCsv` / `exportPdf` (jspdf + autotable, padrão Monte Verde).

### Integrações
- Adiciona item `Banco de Horas` (ícone `Hourglass`) na navegação (`AppLayout.tsx`).
- Rotas em `App.tsx` sob `ProtectedRoute`.
- Reaproveita design tokens Monte Verde (verde #628E3F, etc.).

### Cores das faixas (semantic tokens já existentes)
- Verde: `bg-green-100 text-green-800`
- Amarelo: `bg-yellow-100 text-yellow-800`
- Laranja: `bg-orange-100 text-orange-800`
- Vermelho: `bg-red-100 text-red-800`
Sinal negativo → ícone `AlertTriangle`.

### Entrega
- 1 migration (tabelas + bucket + policies).
- 1 edge function (`parse-ponto-pdf`).
- Hooks: `useBancoHorasImports`, `useBancoHorasBalances`, `useBancoHorasSettings`.
- 5 páginas + componentes auxiliares (KPI cards, charts, faixa chip, trend arrow).
- Utils de cálculo + export CSV/PDF.

Confirma para eu seguir com a migration e a implementação?