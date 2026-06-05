## Módulo "Sucesso do Cliente – DP"

Implementação completa de um guia operacional centralizado por cliente no DP. Escopo grande — proponho entregar em **4 fases sequenciais** para manter qualidade e permitir validação incremental.

---

### Fase 1 — Fundação (base + perfil + uploads + diário)

**Banco de dados (migration única):**
- Estender `clientes` com: `codigo_cliente` (único), `nome_fantasia`, `municipio`, `uf`, `segmento`, `contato_nome`, `contato_telefone`, `contato_email`, `status`
- `client_dp_profile` (1:1 com cliente) — todos os campos de comunicação, ponto, variáveis, prévia, carga horária. Senha do ponto criptografada via `pgcrypto` (`pgp_sym_encrypt` com chave em secret).
- `client_uploads` (versionado por tipo: holerite_modelo, ponto_modelo, outro)
- `client_diary_entries` (não-deletável, apenas arquivável, com tags JSONB e audit)
- `client_audit_log` (genérico: tabela, registro_id, campo, antes, depois, user_id, timestamp)
- Bucket Storage: `cliente-dp-uploads`
- RLS: leitura para `authenticated`; escrita/visualização de senha apenas para `admin`/`master` via `has_role`

**UI:**
- Nova rota `/sucesso-cliente` com layout próprio (sidebar: Perfil, CCT, Rubricas, Checklist, Mensagens, Calendário, Riscos, Importar Excel)
- Tela "Lista de Clientes DP" com busca/filtros (CNPJ, código, nome, possui ponto, prévia, CCT vencendo, risco)
- Tela "Perfil DP do Cliente" com:
  - Barra de completude (% campos preenchidos) + alertas
  - Seções colapsáveis: Comunicação, Ponto/Jornada (campos condicionais), Prévia, Carga Horária, Uploads, Diário
  - Senha do ponto com toggle mostrar/ocultar (só para autorizados)
- Importação Excel de clientes (parser SheetJS, prévia novos/atualizar/conflitos, log de erros exportável)
- Item no menu principal

### Fase 2 — CCT + Rubricas

- Tabelas `client_ccts` (versionada) e `client_rubrics`
- Upload de CCT → edge function `ai-resumo-cct` usando `google/gemini-2.5-flash` para extrair sindicato, vigência, data-base, cláusulas-chave
- Alertas automáticos 30/60/90 dias antes do vencimento
- Botão "Replicar CCT" — selecionar cliente de origem da mesma base sindical
- CRUD de rubricas com import/export CSV, marcação "crítica", incidências (INSS/FGTS/IRRF/DSR/eSocial)

### Fase 3 — Checklist + Mensagens + Calendário + Riscos

- `closing_checklist_templates` (admin define modelo padrão) e `closing_checklist_runs` (por competência YYYY-MM, status por etapa, responsável, anexos)
- `client_message_templates` com placeholders `{{cliente_nome}}`, `{{competencia}}`, `{{prazo}}`, `{{responsavel}}` + botões copiar WhatsApp/e-mail; 6 modelos pré-cadastrados
- `client_calendar_events` (visão mensal + lista; alertas na home do módulo)
- `client_risk_flags` (rotatividade, afastamentos, ponto, passivo, sem retorno) + notas; badge no topo do perfil

### Fase 4 — Relatório PDF + Branding + Auditoria final

- Reuso do `office_branding` existente (logo, cores, contatos)
- Geração PDF via `jspdf` + `jspdf-autotable`: capa com logo/cor primária, seções (identificação, comunicação, ponto, prévia, carga, anexos, CCT resumo, rubricas, diário do período, checklist da competência), rodapé com contatos
- Botão "Emitir Relatório PDF" no perfil com seletor de período (diário) e competência (checklist)
- Painel de auditoria (filtro por cliente/tabela/usuário/período)

---

### Detalhes técnicos

- **Criptografia de senha do ponto:** coluna `timeclock_password_encrypted bytea`, função `set_timeclock_password(client_id, pwd)` e `get_timeclock_password(client_id)` SECURITY DEFINER que checa `has_role(auth.uid(),'admin')` antes de retornar `pgp_sym_decrypt`. Chave simétrica em secret `DP_ENC_KEY`.
- **Excel:** `xlsx` (SheetJS) já presente? Confirmar; se não, `bun add xlsx`.
- **PDF AI CCT:** edge function recebe URL do arquivo no Storage, extrai texto (pdfjs no edge via npm), envia ao Gemini com JSON schema.
- **Multiempresa & permissões:** todas as tabelas com `created_by uuid`; RLS via `has_role`. Perfis: `master`/`admin` veem tudo; `user` vê todos clientes mas não vê senha do ponto.
- **Audit log:** triggers genéricos em `client_dp_profile`, `client_ccts`, `client_rubrics`, `closing_checklist_runs`.

### Premissas / pontos a confirmar

1. **Senha do ponto:** OK criptografar com `pgp_sym_encrypt` e expor apenas via RPC para `admin`/`master`? (alternativa: nunca decriptar no servidor, apenas no front com chave do usuário — mais seguro porém mais complexo)
2. **CCT IA:** usar **Gemini 2.5 Flash** (Lovable AI, sem custo de chave) — OK?
3. **Importação Excel:** match por **CNPJ primeiro, depois código** quando CNPJ ausente — OK?
4. **Permissões:** todos os usuários autenticados podem editar perfil DP, mas só `admin`/`master` veem senha do ponto e fazem importação em massa — OK?

Posso iniciar pela **Fase 1** assim que confirmar essas 4 premissas (ou diga "pode seguir com tudo" e eu adoto os defaults acima).