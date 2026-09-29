# Módulo Taxa de Serviço / Gorjetas

Módulo 100% novo. O único arquivo existente alterado é o menu (`src/components/AppLayout.tsx`) e, para a rota, `src/App.tsx` (uma linha de rota — necessária para a página abrir; confirme se aceita).

## Banco de dados (só CREATE, prefixo `ts_`)
- Usa a tabela existente `clientes` como empresa (FK, somente leitura) — não cria `ts_empresas`.
- Tabelas: `ts_empresa_config`, `ts_funcionarios`, `ts_competencias`, `ts_distribuicao`, `ts_exportacoes` (campos exatamente como na especificação, com unique e updated_at).
- View `ts_saldo_empresa` e função `ts_saldo_disponivel(empresa, competencia)` com saldo sempre derivado por soma.
- Acesso: mesmo padrão das tabelas atuais (usuários autenticados do escritório).

## Função de IA nova
- `supabase/functions/ts-extrair-extrato` — lê PDF de extrato e devolve `[{codigo, nome, rendimento_bruto}]`, registra em `ai_usage_log`.

## Arquivos novos em `src/modules/taxa-servico/`
- `pages/TaxaServicoPage.tsx` — tela inicial (card de saldo, lista de competências, "Nova competência") + stepper
- `components/StepEmpresa.tsx`, `StepValores.tsx`, `StepFuncionarios.tsx`, `StepRateio.tsx`, `StepExportacao.tsx`
- `components/AjusteFechamento.tsx` — aba de ajuste (bruto alvo, recalcular, exportar ajustado)
- `components/ImportarExtratoDialog.tsx` — PDF/XLSX/CSV/TXT, mapeamento de colunas, prévia com checkboxes, upsert
- `components/SaldoCard.tsx`, `SaldoExtratoDialog.tsx` — saldo acumulado e extrato cronológico
- `hooks/useTaxaServico.ts` — leitura/gravação das tabelas `ts_`
- `utils/rateio.ts` — valor do ponto, arredondamento com resíduo para maior pontuação, ajuste idempotente
- `utils/dominioLayout.ts` — gerador do registro "10" (43 posições, CRLF, validações) via array de configuração
- `utils/validacoes.ts` — teto de retenção 20%/33%, saldo disponível
- `utils/__tests__/dominioLayout.test.ts` e `rateio.test.ts` — linha `1000000000952026080025110000216520000000000` e exemplo 3.000/6.500/6.000 → 2.500,00

## Regras-chave
- Retenção só sobre o arrecadado; bloqueio acima do teto do regime.
- Soma das comissões = líquido, ao centavo.
- Revalida saldo antes de exportar; reexportação ajustada substitui o saldo da competência.
