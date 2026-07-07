# Editar e Comentar PDF — Plano de implementação

## Escopo proposto (MVP funcional)

A Central PDF hoje é 100% client-side (nada é enviado a servidores, conforme já informado ao usuário). Vou manter esse mesmo padrão nesta primeira versão, entregando um editor/anotador de PDF completo no navegador. Recursos de multiusuário/permissões/auditoria compartilhada exigem backend e ficam para uma fase 2 opcional.

### O que entra no MVP

**Novo card na Central PDF:** "Editar e Comentar PDF" — abre o editor em tela cheia dentro da própria página.

**Visualização**
- Upload de 1 PDF (com o mesmo `FileDropZone` das outras ferramentas)
- Renderização por página via `pdfjs-dist` (já usado no projeto)
- Miniaturas laterais + navegação
- Zoom in/out, ajustar à largura, rotação visual
- Busca por texto (quando o PDF tem camada de texto)

**Ferramentas de anotação** (camada Konva sobre o canvas do pdf.js)
- Comentário (pin com balão de texto, autor local + data/hora)
- Marca-texto por área retangular (amarelo/verde/rosa/azul/laranja + opacidade)
- Sublinhado e tachado por área
- Caixa de texto livre (fonte, tamanho, cor, fundo, borda)
- Setas, retângulo, círculo, linha (cor, espessura, preenchimento, opacidade)
- Desenho livre (caneta com cor e espessura)
- Lupa/zoom de trecho: seleciona área → gera caixa ampliada reposicionável com linha ligando ao original e legenda opcional
- Carimbos prontos: Conferido, Revisar, Corrigir, Aprovado, Pendente, Urgente, Assinado, Enviado ao cliente + criar carimbos personalizados (salvos em localStorage)

**Painel lateral "Comentários e Marcações"**
- Lista com tipo, página, autor, data/hora, conteúdo
- Filtros por página / tipo / autor
- Ir para página, editar, excluir

**Exportar**
- "Salvar PDF editado" → aplica todas as anotações como camada visual usando `pdf-lib` e baixa `EDITADO - {nome} - {data}.pdf` (arquivo original nunca é sobrescrito)
- "Exportar relatório de comentários" em PDF (jsPDF) e CSV
- Versionamento local: cada exportação vira uma versão salva no histórico

**Histórico local (localStorage)**
- Lista de sessões: nome do arquivo, data, nº de comentários/marcações, versões
- Reabrir sessão (as anotações são restauradas; o PDF original precisa ser reanexado, pois arquivos não persistem no navegador entre sessões)

**Integração OCR**
- Detecção automática: se a página não tem texto extraível, banner:
  "Este PDF parece ser uma imagem/escaneado. Use marcação por área ou aplique OCR antes para selecionar texto."
- Botão leva à ferramenta OCR existente (hoje `PDF → Word` faz extração; se preferir, adiciono item específico "OCR PDF" depois — hoje não existe com esse nome)

### O que NÃO entra no MVP (precisa decisão)

Estes itens do briefing exigem backend, RLS e login — hoje o app tem auth para partes administrativas, mas a Central PDF é pública:
1. Sessões/versões/anotações salvas no Supabase (tabelas `PdfEditSession`, `PdfAnnotation`, `PdfEditVersion`)
2. Auditoria multiusuário (quem editou, controle por empresa/usuário)
3. Permissão "cliente só visualiza vs. edita"
4. Upload dos PDFs em bucket privado

Posso fazer isso em uma segunda entrega, se você confirmar. Nesta primeira o "autor" das anotações usa o `useOperatorName` que já existe no projeto.

## Detalhes técnicos

**Dependências novas**
- `react-konva` + `konva` — camada de anotação vetorial sobre cada página
- (já temos `pdfjs-dist`, `pdf-lib`, `jspdf`, `file-saver`, `docx`)

**Arquitetura de arquivos**
```
src/components/pdftools/tools/EditAnnotateTool.tsx        # entrypoint
src/components/pdftools/editor/
  EditorLayout.tsx          # barra superior + sidebar miniaturas + painel comentários
  PageCanvas.tsx            # pdf.js render + Konva overlay
  Toolbar.tsx               # ferramentas ativas
  AnnotationLayer.tsx       # shapes Konva por tipo
  CommentsPanel.tsx
  StampPicker.tsx
  MagnifierTool.tsx
src/utils/pdfEditor/
  annotations.ts            # tipos + reducer
  renderToPdf.ts            # aplica anotações via pdf-lib
  ocrDetect.ts              # detecta página escaneada
  history.ts                # localStorage (sessões e versões — só metadados)
  reportExport.ts           # PDF/CSV do relatório de comentários
src/pages/PdfToolsPage.tsx  # + novo item em TOOLS
```

**Modelo de anotação (client-side)**
```ts
type Annotation = {
  id: string; page: number; type: 'comment'|'highlight'|'underline'|'strike'
    |'text'|'arrow'|'rect'|'circle'|'line'|'freehand'|'stamp'|'magnifier';
  coords: number[];          // normalizado 0-1 em relação à página
  color?: string; opacity?: number; strokeWidth?: number;
  content?: string;          // texto do comentário / caixa
  stamp?: string;            // rótulo do carimbo
  magnifier?: { source: Rect; target: Rect; zoom: number; label?: string };
  author: string; createdAt: string; updatedAt?: string;
}
```

**Renderização final para PDF**
- Para cada anotação → desenhar no `pdf-lib` no mesmo espaço de coordenadas da página (convertendo do normalizado)
- Marca-texto/sublinhado/tachado → retângulos com opacidade
- Formas/setas/desenho livre → linhas e paths
- Comentários → ícone + texto anexado como texto sobre fundo semi-transparente (não uso `PDFAnnotation` nativo do PDF para manter compatibilidade universal de visualização)
- Lupa → recorta a região usando `embedPage` do `pdf-lib` e re-desenha ampliada, com linha ligando
- Carimbos → texto grande com borda e cor característica

## Estimativa

Entrega em uma sequência de edits: dependências, tipos/reducer, componentes do editor, renderizador para PDF, histórico e integração no `PdfToolsPage`. Sem migrações de banco nesta fase.

## Confirmações que preciso antes de codar

1. **Backend/auditoria/multiusuário:** OK deixar para uma fase 2? (o MVP fica client-side como o resto da Central PDF)
2. **Persistência do PDF entre sessões:** o navegador não guarda arquivos grandes entre reloads. No histórico local salvo metadados + JSON das anotações; ao reabrir, o usuário reanexa o PDF original. Ok? (alternativa: guardar em IndexedDB — funciona mas limita tamanho)
3. **Ferramenta OCR:** hoje não existe um item "OCR PDF" separado — o mais próximo é "PDF → Word". Quer que eu crie um item explícito "OCR PDF" (Tesseract.js no navegador) junto com essa entrega ou só linko para o fluxo existente?