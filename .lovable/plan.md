# Programa Excelência — Premiação por Desempenho

Módulo aditivo dentro da aba "Prêmio/Gratificação". Nada fora dele é alterado (a aba só ganha um botão/seção de entrada "Programa Excelência (pontos)").

## O que você vai ver
Na aba Prêmio, uma nova seção "Programa Excelência" com sub-abas:
Política · Referências por Função · Medalhas · Serviços · Programa de Metas · Desabonos · Lançamentos · Apuração Mensal · Regulamento · Extrato do Colaborador.

- Ao criar a política, ela já vem com medalhas Ouro/Prata/Bronze, os 13 serviços, as 2 metas (sem códigos vinculados) e os 10 desabonos da especificação.
- Alerta enquanto a pontuação de referência estiver zerada.
- Lançamento rápido por código, em lote, com limite por competência e observação obrigatória em desabonos.
- Apuração com Recalcular / Fechar / Reabrir (só admin) / Exportar TXT Domínio, XLSX e PDF.
- Regulamento versionado com os dizeres obrigatórios (7.1), PDF com termo de ciência, registro de ciência (upload ou aceite digital) e aviso de quem não deu ciência.
- Extrato individual em PDF com cards de medalhas e o quadro de cálculo (7.2), com linha vermelha para saldo negativo.

## Pontos de decisão (assumidos)
- **Colaboradores:** o projeto não tem cadastro único de funcionários por empresa com função. Crio `premiacao_colaboradores` (código, nome, cargo_id opcional → `cargos`, ativo) com botão "Importar" dos funcionários da Taxa de Serviço e das políticas de prêmio da mesma empresa.
- **Funções:** referências por função usam a tabela `cargos` já existente da empresa.
- **Vínculo por empresa:** `empresa_id` → `clientes.id`, igual aos módulos `ts_*`.
- Não existem tabelas `premiacao_*` hoje, então nada precisa ser removido.

## Detalhes técnicos
Migração (só CREATE), RLS "Authenticated full access" no padrão atual, GRANTs, triggers de `updated_at`:
`premiacao_politicas, premiacao_colaboradores, premiacao_referencias, premiacao_medalhas, premiacao_servicos, premiacao_metas, premiacao_metas_servicos, premiacao_metas_manuais, premiacao_desabonos, premiacao_lancamentos, premiacao_apuracoes, premiacao_regulamento_versoes, premiacao_ciencias, premiacao_log`.
Snapshot de pontos em cada lançamento e de referência/valor do ponto na apuração.

Funções SQL (RPC):
- `premiacao_seed_politica(politica_id)` — carga inicial.
- `premiacao_apurar(politica_id, competencia)` — calcula todas as regras da seção 5 (medalhas, metas automáticas/manuais, desabonos, teto, saldo inicial da última fechada, limite e meses máximos de saldo negativo, referência por função, valor).
- `premiacao_fechar(politica_id, competencia)` — bloqueia se a anterior estiver aberta.
- `premiacao_reabrir(politica_id, competencia)` — só admin/master, log e recálculo em cascata das posteriores abertas.
- Triggers de log em lançamentos e na política.

Front em `src/modules/premiacao/` (hooks, sub-abas, PDFs regulamento/apuração/extrato, XLSX, TXT reaproveitando `dominioLayout.ts` da Taxa de Serviço). Única alteração externa: inserir a seção no `PremioTab.tsx`.

Ao final: lista das migrations, funções SQL e telas criadas.
