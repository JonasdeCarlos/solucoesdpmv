import { useEffect, useState } from 'react';
import { renderizarPagina, type TipoArquivo } from '../aplicar';
import type { Margens } from '../geometria';

interface Props {
  bytes?: ArrayBuffer | null;
  tipo?: TipoArquivo | null;
  margens: Margens;
  largura?: number;
}

/** Folha A4 com o timbrado e o retângulo tracejado da área útil (atualiza em tempo real). */
export default function TimbradoPreview({ bytes, tipo, margens, largura = 300 }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let vivo = true;
    let url: string | null = null;
    setSrc(null);
    if (!bytes || !tipo) return;
    if (tipo === 'pdf') {
      setCarregando(true);
      renderizarPagina(bytes, 1, largura).then(d => { if (vivo) setSrc(d); }).catch(() => {}).finally(() => vivo && setCarregando(false));
    } else {
      url = URL.createObjectURL(new Blob([bytes], { type: tipo === 'png' ? 'image/png' : 'image/jpeg' }));
      setSrc(url);
    }
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [bytes, tipo, largura]);

  const pct = (mm: number, total: number) => `${Math.max(0, (Number(mm) || 0) / total * 100)}%`;

  return (
    <div className="relative border rounded-sm bg-card shadow-sm overflow-hidden" style={{ width: largura, aspectRatio: '210 / 297' }}>
      {src ? (
        <img src={src} alt="Timbrado" className="absolute inset-0 w-full h-full object-fill" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
          {carregando ? 'Carregando…' : 'Envie o arquivo do timbrado para pré-visualizar'}
        </div>
      )}
      <div
        className="absolute border-2 border-dashed border-primary bg-primary/10"
        style={{
          top: pct(margens.superior, 297),
          bottom: pct(margens.inferior, 297),
          left: pct(margens.esquerda, 210),
          right: pct(margens.direita, 210),
        }}
      >
        <span className="absolute top-1 left-1 text-[10px] font-medium text-primary bg-background/80 px-1 rounded">Área útil</span>
      </div>
    </div>
  );
}
