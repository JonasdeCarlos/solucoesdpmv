# Política personalizada criada com IA

## O que o usuário verá
Em **Nova política**, um novo bloco destacado: **"Criar uma política nova, do seu jeito (com IA)"**.
- Campo grande de texto: "Explique como deve funcionar esta política" (quem participa, o que é medido, metas, como se divide o dinheiro, periodicidade, regras de perda).
- Área para anexar arquivos (PDF, Word, Excel/CSV, imagens/fotos de planilhas).
- Botão **"Montar política com IA"** → abre uma **prévia** antes de salvar, mostrando:
  - nome, objetivo, regra do prêmio e periodicidade;
  - **indicadores coletivos** (ex.: faturamento, nota de clientes, % de meta, quantidade produzida) com peso e faixas (piso / meta 1 / meta 2 / meta 3);
  - **critérios individuais** com peso e descrição (usados na avaliação e nos feedbacks);
  - divisão coletivo x individual e forma de rateio (por pontos ou igualitário).
  - Tudo editável na prévia; botão "Refazer com IA" com instruções de ajuste.
- Ao confirmar, a política é criada como **modelo "Personalizado"** e passa a ter as mesmas telas que o modelo Hotelaria já tem: política em PDF, metas do mês, apuração por competência, avaliação individual, relatórios finais por colaborador, feedbacks e link público.

## Como a apuração funciona para modelos novos
O motor de apuração do modelo Hotelaria é generalizado. Além dos tipos atuais (faturamento, nota média, % avaliações), cada indicador pode ser:
- **Valor realizado x meta** (R$ ou quantidade; quanto maior, melhor)
- **Valor realizado x meta (quanto menor, melhor)** (ex.: perdas, reclamações, faltas)
- **Percentual atingido** (0–100%)
- **Nota média** genérica (com escala informada)
- **Sim/Não** (atingiu ou não)

Na apuração o usuário digita o realizado de cada indicador; o sistema enquadra na faixa, calcula o valor do coletivo, rateia por pontos/dias e soma o individual das avaliações — igual ao que já acontece hoje.

A política Hotelaria atual não muda.

## Detalhes técnicos
- Nova edge `premio-politica-personalizada-ia` (Lovable AI Gateway, modelo padrão, streaming), reaproveitando a extração de PDF/DOCX do `premio-politica-ia` + leitura de XLSX/CSV; retorna JSON no formato `HotelariaConfig` estendido + critérios individuais + textos da política. Validação/saneamento no servidor.
- `modelo_template = 'personalizado'`; config salva em `hotelaria_config` (colunas já existentes — sem migração).
- `premioTemplates.ts`: novos valores de `metrica` (`realizado_meta`, `realizado_meta_inverso`, `percentual`, `nota_generica`, `sim_nao`) + `unidade`/`escala_max` opcionais.
- `PremioHotelariaSection.tsx`: enquadramento de faixa para as novas métricas e inputs de "realizado" por indicador; `isHotelaria` passa a aceitar `personalizado` em PremioTab, PDFs (política, apuração, relatório final) e link público.
- Novo componente `PoliticaPersonalizadaIaDialog.tsx` (descrição, anexos, prévia editável, refazer).
