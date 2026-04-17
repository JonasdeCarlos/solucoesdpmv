import { useState } from 'react';
import {
  Combine, Scissors, Minimize2, RotateCw, ArrowLeftRight,
  Trash2, ImageIcon, FileImage, ArrowLeft,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PdfToolCard from '@/components/pdftools/PdfToolCard';
import MergeTool from '@/components/pdftools/tools/MergeTool';
import SplitTool from '@/components/pdftools/tools/SplitTool';
import CompressTool from '@/components/pdftools/tools/CompressTool';
import RotateTool from '@/components/pdftools/tools/RotateTool';
import ReorderTool from '@/components/pdftools/tools/ReorderTool';
import RemovePagesTool from '@/components/pdftools/tools/RemovePagesTool';
import ImagesToPdfTool from '@/components/pdftools/tools/ImagesToPdfTool';
import PdfToImagesTool from '@/components/pdftools/tools/PdfToImagesTool';

type ToolId =
  | 'merge' | 'split' | 'compress' | 'rotate'
  | 'reorder' | 'remove' | 'images-to-pdf' | 'pdf-to-images';

interface ToolDef {
  id: ToolId;
  title: string;
  description: string;
  icon: typeof Combine;
  Component: React.ComponentType;
}

const TOOLS: ToolDef[] = [
  { id: 'merge', title: 'Juntar PDFs', description: 'Combine vários PDFs em um único arquivo.', icon: Combine, Component: MergeTool },
  { id: 'split', title: 'Dividir PDF', description: 'Extraia páginas específicas em novos arquivos.', icon: Scissors, Component: SplitTool },
  { id: 'compress', title: 'Compactar PDF', description: 'Reduza o tamanho otimizando streams.', icon: Minimize2, Component: CompressTool },
  { id: 'rotate', title: 'Rotacionar páginas', description: 'Gire páginas em 90°, 180° ou 270°.', icon: RotateCw, Component: RotateTool },
  { id: 'reorder', title: 'Reordenar páginas', description: 'Reorganize a sequência de páginas.', icon: ArrowLeftRight, Component: ReorderTool },
  { id: 'remove', title: 'Excluir páginas', description: 'Remova páginas específicas do PDF.', icon: Trash2, Component: RemovePagesTool },
  { id: 'images-to-pdf', title: 'Imagens → PDF', description: 'Combine JPG/PNG em um PDF.', icon: ImageIcon, Component: ImagesToPdfTool },
  { id: 'pdf-to-images', title: 'PDF → Imagens', description: 'Cada página vira uma imagem JPG.', icon: FileImage, Component: PdfToImagesTool },
];

const PdfToolsPage = () => {
  const [active, setActive] = useState<ToolId | null>(null);
  const tool = TOOLS.find(t => t.id === active);

  if (tool) {
    const Component = tool.Component;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setActive(null)} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Central de PDF
        </Button>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <tool.icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{tool.title}</h2>
              <p className="text-xs text-muted-foreground">{tool.description}</p>
            </div>
          </div>
          <Component />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Central de PDF</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ferramentas rápidas para manipular PDFs. Tudo processado no seu navegador — nada é enviado a servidores.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map(t => (
          <PdfToolCard
            key={t.id}
            icon={t.icon}
            title={t.title}
            description={t.description}
            onClick={() => setActive(t.id)}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Limite: 100 MB por arquivo. Operações pesadas em PDFs grandes podem demorar.
      </p>
    </div>
  );
};

export default PdfToolsPage;
