---
name: Provisões e Reflexos DSR
description: Módulo de cadastro de verbas com cálculo de DSR mês a mês baseado em DU/Dias DSR
type: feature
---
Módulo /provisoes-dsr com 4 abas: Verbas (estende tabela `verbas` com codigo, tipo_lancamento, incide_dsr, regra_dsr, considera_domingo_dsr, considera_feriado_dsr, observacoes), Lançamentos (tabela `provision_entries` por empresa+competência), Calendário (estende `feriados_municipais` com municipio/uf/escopo/conta_dia_nao_util/conta_dsr + tabela `feriados_nacionais_overrides` para marcar nacionais como ponto facultativo), Apuração DSR (tabela `dsr_monthly_results` + memória de cálculo + export PDF/CSV).

Fórmula padrão: DSR = (Base ÷ DU) × Dias DSR.
Regras de contagem: sábado conta como útil (parametrizável), domingo nunca útil; feriados nacionais via algoritmo de Páscoa em src/utils/dsrCalculations.ts; nacionais marcados como ponto facultativo são excluídos; municipais/estaduais/internos só entram se cadastrados; bloqueia cálculo se DU=0.
