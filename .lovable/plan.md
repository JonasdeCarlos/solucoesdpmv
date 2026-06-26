## Submódulo "Verba Variável – Critérios, Apuração e Alinhamento"

Entrega faseada dentro de **Sucesso do Cliente – DP**. O nome da verba é **configurável por política** (Prêmio, Gratificação, Bonificação, Participação, Incentivo etc.), refletindo em telas, PDFs, feedbacks da IA e exportação Domínio.

---

### Nome da verba configurável

- Campo `verba_label` em cada `prize_policies` (default: "Prêmio") com sugestões rápidas: Prêmio / Gratificação / Bonificação / Participação / Incentivo / Outro (texto livre).
- Campo `verba_label_plural` opcional (default derivado).
- Toda UI usa `{{verba_label}}`: títulos, botões ("Gerar critérios de {{verba_label}}"), avisos, dashboard.
- Edge functions de IA recebem `verba_label` e substituem nos prompts e respostas.
- PDF de alinhamento e arquivo Domínio usam o rótulo escolhido.
- Configuração global por cliente em "Links" (rótulo default), sobrescrita por política.

---

### Fase 1 — Fundação (DB + Política + Critérios IA + Link público)

**Banco (migration única, com GRANTs e RLS):**
- `prize_policies` (inclui `verba_label`, `verba_label_plural`, objetivo, período, escopo, tipo, valor base, rubrica, status)
- `prize_criteria`, `prize_employees`, `prize_assessments`, `prize_assessment_employees`, `prize_assessment_criterion_results`
- `prize_alignment_reports`, `prize_dominio_exports`
- `client_prize_links` (token, validade, permissões JSON, `default_verba_label`, log de acesso)
- Bucket `premio-docs` (privado)
- RLS: admin/master tudo; authenticated CRUD; rotas públicas via token validado em edge function

**Edge functions:**
- `premio-criterios-sugerir` — Gemini gera critérios objetivos a partir do objetivo + `verba_label`
- `premio-publico` — `verify_jwt=false`, valida token e expõe CRUD por permissões

**UI:**
- Aba "Verba Variável" no perfil do cliente (rótulo dinâmico se houver política ativa)
- Tela admin "Links por Cliente" (gerar/copiar/ativar/validade/permissões/default rótulo)
- Rota pública `/empresa/:token/premio` — cadastro de política (com seletor de rótulo) + objetivo + "Gerar critérios" + aprovar/editar/excluir/reordenar/duplicar/manuais
- Aviso jurídico fixo em todas as telas

### Fase 2 — Empregados + Apuração + Cálculo + Feedback IA

- CRUD `prize_employees` (manual + Excel/CSV, vínculo por política, histórico por competência)
- Tela "Apuração" — slider 0–100% + input por critério, observação obrigatória <100%, upload de evidências, status
- Cálculo: média ponderada/simples, valor = base × %, trava por critério essencial, arredondamento e mínimo configuráveis
- `premio-feedback-gerar` — feedback por critério e geral; mensagens especiais a 100%; respeita `verba_label`

### Fase 3 — PDF de alinhamento + Exportação Domínio

- `utils/sucessoCliente/premioAlinhamentoPdf.ts` — A4, branding, tabela de critérios, observações, feedback IA, % final, valor, parecer, assinaturas; títulos e textos usam `verba_label`
- Status: Rascunho / Emitido / Assinado (upload) / Arquivado
- Exportação Domínio: layout configurável (separador, código rubrica, formato competência, decimais, zerados), prévia + validação, `.txt` + log

### Fase 4 — Dashboard + Integração

- Dashboard com filtros, KPIs, ranking, faixas de distribuição, total por setor, critérios fracos
- Relatórios PDF/CSV/Excel
- Perfil DP: card com políticas ativas, pendências, total estimado, últimos alinhamentos, última exportação
- Checklist de fechamento: 7 etapas pré-definidas
- Rubricas: vínculo política→rubrica + layout Domínio
- Auditoria via `client_audit_log`

---

### Detalhes técnicos

- **IA**: `google/gemini-2.5-flash` via Lovable AI Gateway, tracking em `ai_usage_log`
- **Acesso público**: padrão idêntico ao módulo Feedback (token UUID, sem login)
- **PDF**: `jspdf` + `jspdf-autotable` com `office_branding`
- **Excel**: `xlsx` (já presente)
- **Multiempresa**: RLS via `has_role`; tabelas com `client_id` + `created_by`
- **Nome interno das tabelas** permanece `prize_*` por simplicidade técnica — usuário nunca vê esse nome.

### Premissas

1. Nome da verba configurável por política, com defaults sugeridos e texto livre — OK?
2. IA: Lovable AI (Gemini Flash) — OK?
3. Acesso público igual ao Feedback (token UUID, sem login) — OK?
4. Branding do PDF reusando `office_branding` — OK?

Confirme as premissas (ou diga "pode seguir com tudo") e começo pela **Fase 1**.
