import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  MessageSquare, Highlighter, Underline as UnderlineIcon, Strikethrough,
  Type, ArrowUpRight, Square, Circle, Minus, Pen, Stamp, ZoomIn,
  MousePointer2, Trash2, Download, FileText, Save, Search, ZoomOut, Maximize2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Annotation, AnnotationType, EditorSessionMeta } from '@/utils/pdfEditor/types';
import { HIGHLIGHT_COLORS, STAMP_PRESETS } from '@/utils/pdfEditor/types';
import { createSession, upsertSession, loadCustomStamps, saveCustomStamps } from '@/utils/pdfEditor/history';
import { renderAnnotationsToPdf } from '@/utils/pdfEditor/renderToPdf';
import { exportCommentsCsv, exportCommentsPdf } from '@/utils/pdfEditor/reportExport';
import { getOperatorName, ensureOperatorName } from '@/hooks/useOperatorName';

interface Props {
  file: File;
  onExit: () => void;
  initialSession?: EditorSessionMeta;
}

type Tool =
  | 'select' | 'comment' | 'highlight' | 'underline' | 'strike'
  | 'text' | 'arrow' | 'rect' | 'circle' | 'line' | 'freehand'
  | 'stamp' | 'magnifier';

const uid = () => `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const TOOL_LABELS: Record<Tool, string> = {
  select: 'Selecionar',
  comment: 'Comentário',
  highlight: 'Marca-texto',
  underline: 'Sublinhado',
  strike: 'Tachado',
  text: 'Caixa de texto',
  arrow: 'Seta',
  rect: 'Retângulo',
  circle: 'Círculo',
  line: 'Linha',
  freehand: 'Desenho livre',
  stamp: 'Carimbo',
  magnifier: 'Lupa/Zoom de trecho',
};

export default function PdfAnnotationEditor({ file, onExit, initialSession }: Props) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState('#fff176');
  const [strokeColor, setStrokeColor] = useState('#e53935');
  const [opacity, setOpacity] = useState(0.6);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [textSize, setTextSize] = useState(14);
  const [stampKind, setStampKind] = useState('conferido');
  const [session, setSession] = useState<EditorSessionMeta>(
    () => initialSession || createSession(file.name)
  );
  const [annotations, setAnnotations] = useState<Annotation[]>(
    initialSession?.annotations || []
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingComment, setPendingComment] = useState<{ id: string; x: number; y: number } | null>(null);
  const [pendingText, setPendingText] = useState<{ id: string; x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [customStamps, setCustomStamps] = useState(loadCustomStamps());
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isScanned, setIsScanned] = useState<boolean | null>(null);
  const [filterPage, setFilterPage] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [customStampDialog, setCustomStampDialog] = useState(false);
  const [newStamp, setNewStamp] = useState({ label: '', color: '#c62828' });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState({ w: 800, h: 1000 });
  const [drawing, setDrawing] = useState<Annotation | null>(null);
  const [magnifierStep, setMagnifierStep] = useState<0 | 1>(0); // 0=source, 1=target
  const [pendingMag, setPendingMag] = useState<{ src: { x: number; y: number; w: number; h: number } } | null>(null);
  const arrayBufferRef = useRef<ArrayBuffer | null>(null);

  // Load PDF
  useEffect(() => {
    let mounted = true;
    (async () => {
      const pdfjs: any = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const bytes = await file.arrayBuffer();
      arrayBufferRef.current = bytes.slice(0);
      const doc = await pdfjs.getDocument({ data: bytes }).promise;
      if (!mounted) return;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);

      // Thumbnails
      const thumbs: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const p = await doc.getPage(i);
        const vp = p.getViewport({ scale: 0.2 });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        await p.render({ canvasContext: c.getContext('2d')!, viewport: vp, canvas: c }).promise;
        thumbs.push(c.toDataURL('image/jpeg', 0.7));
      }
      if (mounted) setThumbnails(thumbs);

      // Scanned detection: first page text content length
      try {
        const p1 = await doc.getPage(1);
        const tc = await p1.getTextContent();
        setIsScanned(tc.items.length < 3);
      } catch { setIsScanned(false); }
    })();
    return () => { mounted = false; };
  }, [file]);

  // Render page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom, rotation });
      const canvas = canvasRef.current!;
      if (cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageSize({ w: viewport.width, h: viewport.height });
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise;
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, zoom, rotation]);

  // Persist session
  useEffect(() => {
    const s: EditorSessionMeta = {
      ...session,
      annotations,
      updatedAt: new Date().toISOString(),
    };
    setSession(s);
    upsertSession(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations]);

  const pageAnnots = useMemo(
    () => annotations.filter((a) => a.page === currentPage),
    [annotations, currentPage]
  );

  const filteredList = useMemo(() => {
    return annotations.filter((a) => {
      if (filterPage !== 'all' && a.page !== Number(filterPage)) return false;
      if (filterType !== 'all' && a.type !== filterType) return false;
      return true;
    });
  }, [annotations, filterPage, filterType]);

  const svgToPageCoords = (e: React.MouseEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const addAnnotation = (partial: Partial<Annotation> & { type: AnnotationType }) => {
    const author = getOperatorName() || ensureOperatorName() || 'Operador';
    const a: Annotation = {
      id: uid(),
      page: currentPage,
      author,
      createdAt: new Date().toISOString(),
      color: strokeColor,
      opacity,
      strokeWidth: strokeWidth / 500,
      ...partial,
    } as Annotation;
    setAnnotations((prev) => [...prev, a]);
    return a;
  };

  const updateAnnotation = (id: string, patch: Partial<Annotation>) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a))
    );
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (tool === 'select') return;
    const p = svgToPageCoords(e);

    if (tool === 'comment') {
      const a = addAnnotation({ type: 'comment', x: p.x, y: p.y, color: '#f59e0b', content: '' });
      setPendingComment({ id: a.id, x: p.x, y: p.y });
      return;
    }
    if (tool === 'text') {
      const a = addAnnotation({
        type: 'text', x: p.x, y: p.y, content: '',
        fontSize: textSize / 500, fill: undefined,
      });
      setPendingText({ id: a.id, x: p.x, y: p.y });
      return;
    }
    if (tool === 'stamp') {
      const preset = [...STAMP_PRESETS, ...customStamps].find((s) => s.key === stampKind);
      addAnnotation({
        type: 'stamp', x: p.x, y: p.y,
        stampKind, content: preset?.label || stampKind,
        color: preset?.color || '#c62828', fontSize: textSize / 500,
      });
      return;
    }
    if (tool === 'magnifier') {
      if (magnifierStep === 0) {
        setDrawing({ id: 'tmp', page: currentPage, type: 'rect', x: p.x, y: p.y, w: 0, h: 0, color: strokeColor, author: '', createdAt: '' });
      } else if (pendingMag) {
        setDrawing({ id: 'tmp', page: currentPage, type: 'rect', x: p.x, y: p.y, w: 0, h: 0, color: strokeColor, author: '', createdAt: '' });
      }
      return;
    }

    // Shape/highlight/underline/strike/rect/circle/arrow/line/freehand
    if (tool === 'freehand') {
      setDrawing({
        id: 'tmp', page: currentPage, type: 'freehand',
        points: [p], color: strokeColor, strokeWidth: strokeWidth / 500,
        author: '', createdAt: '',
      });
      return;
    }

    const typeMap: Record<string, AnnotationType> = {
      highlight: 'highlight', underline: 'underline', strike: 'strike',
      rect: 'rect', circle: 'circle', arrow: 'arrow', line: 'line',
    };
    const t = typeMap[tool];
    if (!t) return;
    const isLine = t === 'arrow' || t === 'line';
    setDrawing({
      id: 'tmp', page: currentPage, type: t,
      x: p.x, y: p.y,
      ...(isLine ? { x2: p.x, y2: p.y } : { w: 0, h: 0 }),
      color: t === 'highlight' ? color : strokeColor,
      opacity: t === 'highlight' ? opacity : 1,
      strokeWidth: strokeWidth / 500,
      author: '', createdAt: '',
    });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const p = svgToPageCoords(e);
    setDrawing((d) => {
      if (!d) return d;
      if (d.type === 'freehand') {
        return { ...d, points: [...(d.points || []), p] };
      }
      if (d.type === 'arrow' || d.type === 'line') {
        return { ...d, x2: p.x, y2: p.y };
      }
      return { ...d, w: p.x - (d.x || 0), h: p.y - (d.y || 0) };
    });
  };

  const onMouseUp = () => {
    if (!drawing) return;
    let d = drawing;
    // normalize negative width/height
    if (d.w != null && d.h != null) {
      const nx = d.w < 0 ? (d.x || 0) + d.w : d.x || 0;
      const ny = d.h < 0 ? (d.y || 0) + d.h : d.y || 0;
      d = { ...d, x: nx, y: ny, w: Math.abs(d.w), h: Math.abs(d.h) };
    }

    if (tool === 'magnifier') {
      if (magnifierStep === 0 && d.w != null && d.h != null && d.w > 0.01 && d.h > 0.01) {
        setPendingMag({ src: { x: d.x!, y: d.y!, w: d.w, h: d.h } });
        setMagnifierStep(1);
        setDrawing(null);
        toast.info('Agora clique e arraste para desenhar onde a ampliação deve aparecer.');
        return;
      }
      if (magnifierStep === 1 && pendingMag && d.w != null && d.h != null && d.w > 0.01 && d.h > 0.01) {
        const label = window.prompt('Legenda da ampliação (opcional):') || '';
        addAnnotation({
          type: 'magnifier', x: d.x, y: d.y, w: d.w, h: d.h,
          color: strokeColor,
          magnifier: { src: pendingMag.src, zoom: 2, label },
        });
        setPendingMag(null);
        setMagnifierStep(0);
      }
      setDrawing(null);
      return;
    }

    if (d.type === 'freehand' && (d.points?.length || 0) > 1) {
      addAnnotation({ type: 'freehand', points: d.points, color: strokeColor });
    } else if (d.type === 'arrow' || d.type === 'line') {
      if (d.x != null && d.x2 != null && (Math.abs(d.x2 - d.x) > 0.005 || Math.abs((d.y2 || 0) - (d.y || 0)) > 0.005)) {
        addAnnotation({ type: d.type, x: d.x, y: d.y, x2: d.x2, y2: d.y2, color: strokeColor });
      }
    } else if (d.w != null && d.h != null && d.w > 0.005 && d.h > 0.005) {
      addAnnotation({
        type: d.type,
        x: d.x, y: d.y, w: d.w, h: d.h,
        color: d.type === 'highlight' ? color : strokeColor,
        opacity: d.type === 'highlight' ? opacity : 1,
      });
    }
    setDrawing(null);
  };

  const doSearch = async () => {
    if (!pdfDoc || !searchTerm.trim()) { setSearchResults([]); return; }
    const term = searchTerm.toLowerCase();
    const results: number[] = [];
    for (let i = 1; i <= numPages; i++) {
      const p = await pdfDoc.getPage(i);
      const tc = await p.getTextContent();
      const text = tc.items.map((it: any) => it.str || '').join(' ').toLowerCase();
      if (text.includes(term)) results.push(i);
    }
    setSearchResults(results);
    if (results.length) {
      setCurrentPage(results[0]);
      toast.success(`${results.length} página(s) com "${searchTerm}"`);
    } else toast.info('Termo não encontrado.');
  };

  const handleSavePdf = async () => {
    if (!arrayBufferRef.current) return;
    setBusy(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const outName = `EDITADO - ${file.name.replace(/\.pdf$/i, '')} - ${dateStr}.pdf`;
      await renderAnnotationsToPdf(arrayBufferRef.current.slice(0), annotations, outName);
      const versionNumber = (session.versions.length || 0) + 1;
      const updated: EditorSessionMeta = {
        ...session,
        annotations,
        versions: [...session.versions, {
          versionNumber, savedAt: new Date().toISOString(), fileName: outName,
        }],
        updatedAt: new Date().toISOString(),
      };
      setSession(updated);
      upsertSession(updated);
      toast.success('PDF editado gerado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar PDF.');
    } finally { setBusy(false); }
  };

  const addCustomStamp = () => {
    if (!newStamp.label.trim()) return;
    const list = [...customStamps, {
      key: `cust_${Date.now()}`, label: newStamp.label.trim().toUpperCase(), color: newStamp.color,
    }];
    setCustomStamps(list);
    saveCustomStamps(list);
    setCustomStampDialog(false);
    setNewStamp({ label: '', color: '#c62828' });
  };

  // ============ RENDER ============
  const nx = (v: number) => v * pageSize.w;
  const ny = (v: number) => v * pageSize.h;

  const renderShape = (a: Annotation, isDrawing = false) => {
    const stroke = Math.max(1, (a.strokeWidth ?? 0.003) * Math.min(pageSize.w, pageSize.h));
    const common = { stroke: a.color || '#e53935', strokeWidth: stroke, fill: 'none', opacity: a.opacity ?? 1 };
    const onClick = (e: React.MouseEvent) => {
      if (tool === 'select') { e.stopPropagation(); setSelectedId(a.id); }
    };
    switch (a.type) {
      case 'highlight':
      case 'underline':
      case 'strike':
      case 'rect':
        if (a.x == null || a.y == null || a.w == null || a.h == null) return null;
        if (a.type === 'highlight') {
          return <rect key={a.id} x={nx(a.x)} y={ny(a.y)} width={nx(a.w)} height={ny(a.h)}
            fill={a.color} opacity={(a.opacity ?? 0.6)} onClick={onClick} style={{ cursor: 'pointer' }} />;
        }
        if (a.type === 'underline') {
          return <line key={a.id} x1={nx(a.x)} y1={ny(a.y + a.h)} x2={nx(a.x + a.w)} y2={ny(a.y + a.h)}
            {...common} onClick={onClick} style={{ cursor: 'pointer' }} />;
        }
        if (a.type === 'strike') {
          return <line key={a.id} x1={nx(a.x)} y1={ny(a.y + a.h / 2)} x2={nx(a.x + a.w)} y2={ny(a.y + a.h / 2)}
            {...common} onClick={onClick} style={{ cursor: 'pointer' }} />;
        }
        return <rect key={a.id} x={nx(a.x)} y={ny(a.y)} width={nx(a.w)} height={ny(a.h)}
          {...common} fill={a.fill || 'none'} onClick={onClick} style={{ cursor: 'pointer' }} />;
      case 'circle':
        if (a.x == null || a.y == null || a.w == null || a.h == null) return null;
        return <ellipse key={a.id}
          cx={nx(a.x + a.w / 2)} cy={ny(a.y + a.h / 2)}
          rx={Math.abs(nx(a.w) / 2)} ry={Math.abs(ny(a.h) / 2)}
          {...common} onClick={onClick} style={{ cursor: 'pointer' }} />;
      case 'line':
        if (a.x == null || a.x2 == null) return null;
        return <line key={a.id} x1={nx(a.x)} y1={ny(a.y!)} x2={nx(a.x2)} y2={ny(a.y2!)}
          {...common} onClick={onClick} style={{ cursor: 'pointer' }} />;
      case 'arrow': {
        if (a.x == null || a.x2 == null) return null;
        const sx = nx(a.x), sy = ny(a.y!), ex = nx(a.x2), ey = ny(a.y2!);
        const ang = Math.atan2(ey - sy, ex - sx);
        const head = Math.max(8, stroke * 4);
        return (
          <g key={a.id} onClick={onClick} style={{ cursor: 'pointer' }}>
            <line x1={sx} y1={sy} x2={ex} y2={ey} {...common} />
            <line x1={ex} y1={ey} x2={ex - head * Math.cos(ang - Math.PI / 6)} y2={ey - head * Math.sin(ang - Math.PI / 6)} {...common} />
            <line x1={ex} y1={ey} x2={ex - head * Math.cos(ang + Math.PI / 6)} y2={ey - head * Math.sin(ang + Math.PI / 6)} {...common} />
          </g>
        );
      }
      case 'freehand': {
        if (!a.points || a.points.length < 2) return null;
        const d = a.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${nx(p.x)},${ny(p.y)}`).join(' ');
        return <path key={a.id} d={d} {...common} strokeLinecap="round" strokeLinejoin="round" onClick={onClick} style={{ cursor: 'pointer' }} />;
      }
      case 'text':
        if (a.x == null || a.y == null) return null;
        return (
          <g key={a.id} onClick={onClick} style={{ cursor: 'pointer' }}>
            {a.fill && (
              <rect x={nx(a.x) - 2} y={ny(a.y)} width={((a.content || '').length) * (a.fontSize || 0.02) * pageSize.w * 0.55} height={(a.fontSize || 0.02) * pageSize.h * 1.4} fill={a.fill} opacity={a.opacity ?? 0.9} />
            )}
            <text x={nx(a.x)} y={ny(a.y) + (a.fontSize || 0.02) * pageSize.h}
              fontSize={(a.fontSize || 0.02) * Math.min(pageSize.w, pageSize.h)}
              fill={a.color} style={{ whiteSpace: 'pre' }}>
              {(a.content || '').split('\n').map((line, i) => (
                <tspan key={i} x={nx(a.x!)} dy={i === 0 ? 0 : '1.2em'}>{line || ' '}</tspan>
              ))}
            </text>
          </g>
        );
      case 'comment': {
        if (a.x == null || a.y == null) return null;
        return (
          <g key={a.id} onClick={onClick} style={{ cursor: 'pointer' }}>
            <circle cx={nx(a.x)} cy={ny(a.y)} r={10} fill={a.color || '#f59e0b'} stroke="#fff" strokeWidth={2} />
            <text x={nx(a.x)} y={ny(a.y) + 4} fontSize={12} fill="#fff" textAnchor="middle" fontWeight="bold">!</text>
          </g>
        );
      }
      case 'stamp': {
        if (a.x == null || a.y == null) return null;
        const label = a.content || (a.stampKind || '').toUpperCase();
        const fs = (a.fontSize || 0.028) * Math.min(pageSize.w, pageSize.h);
        return (
          <g key={a.id} onClick={onClick} style={{ cursor: 'pointer' }}>
            <text x={nx(a.x)} y={ny(a.y) + fs} fontSize={fs} fontWeight="bold" fill={a.color} stroke={a.color} strokeWidth={0.5}>
              {label}
            </text>
          </g>
        );
      }
      case 'magnifier': {
        if (a.x == null || a.y == null || a.w == null || a.h == null || !a.magnifier) return null;
        const src = a.magnifier.src;
        return (
          <g key={a.id} onClick={onClick} style={{ cursor: 'pointer' }}>
            <rect x={nx(src.x)} y={ny(src.y)} width={nx(src.w)} height={ny(src.h)}
              fill="none" stroke={a.color} strokeWidth={1.5} strokeDasharray="4 3" />
            <rect x={nx(a.x)} y={ny(a.y)} width={nx(a.w)} height={ny(a.h)}
              fill="#fff8" stroke={a.color} strokeWidth={2} />
            <line x1={nx(src.x + src.w / 2)} y1={ny(src.y + src.h / 2)}
              x2={nx(a.x + a.w / 2)} y2={ny(a.y + a.h / 2)}
              stroke={a.color} strokeWidth={1} opacity={0.6} />
            <text x={nx(a.x + a.w / 2)} y={ny(a.y + a.h / 2)} textAnchor="middle" fill={a.color} fontSize={12}>
              {a.magnifier.label || 'AMPLIAÇÃO'}
            </text>
          </g>
        );
      }
    }
    return null;
    void isDrawing;
  };

  const ToolBtn = ({ id, icon: Icon }: { id: Tool; icon: any }) => (
    <Button
      type="button" size="sm"
      variant={tool === id ? 'default' : 'ghost'}
      onClick={() => { setTool(id); setMagnifierStep(0); setPendingMag(null); }}
      title={TOOL_LABELS[id]}
      className="h-9 w-9 p-0"
    >
      <Icon className="w-4 h-4" />
    </Button>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[600px] gap-2">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-2">
        <Button size="sm" variant="outline" onClick={onExit}>Voltar</Button>
        <span className="text-xs text-muted-foreground truncate max-w-[220px]">{file.name}</span>
        <div className="flex items-center gap-1 border rounded p-0.5">
          <ToolBtn id="select" icon={MousePointer2} />
          <ToolBtn id="comment" icon={MessageSquare} />
          <ToolBtn id="highlight" icon={Highlighter} />
          <ToolBtn id="underline" icon={UnderlineIcon} />
          <ToolBtn id="strike" icon={Strikethrough} />
          <ToolBtn id="text" icon={Type} />
          <ToolBtn id="arrow" icon={ArrowUpRight} />
          <ToolBtn id="rect" icon={Square} />
          <ToolBtn id="circle" icon={Circle} />
          <ToolBtn id="line" icon={Minus} />
          <ToolBtn id="freehand" icon={Pen} />
          <ToolBtn id="stamp" icon={Stamp} />
          <ToolBtn id="magnifier" icon={ZoomIn} />
        </div>

        {/* Contextual style controls */}
        {(tool === 'highlight') && (
          <div className="flex items-center gap-1">
            {HIGHLIGHT_COLORS.map((c) => (
              <button key={c.value} onClick={() => setColor(c.value)} title={c.name}
                className={`w-6 h-6 rounded border ${color === c.value ? 'ring-2 ring-primary' : ''}`}
                style={{ background: c.value }} />
            ))}
            <div className="w-24 ml-2">
              <Slider value={[opacity * 100]} min={20} max={100} step={5}
                onValueChange={(v) => setOpacity(v[0] / 100)} />
            </div>
          </div>
        )}
        {['underline','strike','arrow','rect','circle','line','freehand','text','comment'].includes(tool) && (
          <>
            <Input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)}
              className="h-8 w-10 p-0.5" />
            <div className="w-24">
              <Slider value={[strokeWidth]} min={1} max={10} step={1}
                onValueChange={(v) => setStrokeWidth(v[0])} />
            </div>
            {tool === 'text' && (
              <Input type="number" value={textSize} onChange={(e) => setTextSize(Number(e.target.value) || 14)}
                className="h-8 w-16" min={8} max={72} />
            )}
          </>
        )}
        {tool === 'stamp' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                {[...STAMP_PRESETS, ...customStamps].find((s) => s.key === stampKind)?.label || 'Escolher'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 grid grid-cols-2 gap-1">
              {[...STAMP_PRESETS, ...customStamps].map((s) => (
                <button key={s.key} onClick={() => setStampKind(s.key)}
                  className={`text-xs font-bold p-1 border-2 rounded ${stampKind === s.key ? 'ring-2 ring-primary' : ''}`}
                  style={{ color: s.color, borderColor: s.color }}>
                  {s.label}
                </button>
              ))}
              <Button size="sm" variant="outline" className="col-span-2 mt-1"
                onClick={() => setCustomStampDialog(true)}>
                + Novo carimbo
              </Button>
            </PopoverContent>
          </Popover>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}><ZoomOut className="w-4 h-4" /></Button>
          <span className="text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(3, z + 0.15))}><ZoomIn className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => {
            if (!containerRef.current) return;
            const cw = containerRef.current.clientWidth - 40;
            setZoom(cw / (pageSize.w / zoom));
          }}><Maximize2 className="w-4 h-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setRotation((r) => (r + 90) % 360)}>↻</Button>
          <div className="flex items-center gap-1 ml-2">
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doSearch()}
              placeholder="Buscar…" className="h-8 w-32" />
            <Button size="sm" variant="ghost" onClick={doSearch}><Search className="w-4 h-4" /></Button>
          </div>
          <Button size="sm" onClick={handleSavePdf} disabled={busy}>
            <Save className="w-4 h-4 mr-1" /> Salvar PDF
          </Button>
        </div>
      </div>

      {isScanned && (
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded px-3 py-2">
          Este PDF parece ser uma imagem/escaneado. Use marcação por área (retângulo, seta, comentário) ou aplique OCR antes para selecionar texto.
          Use a ferramenta <b>PDF → Word</b> da Central de PDF para extrair o texto.
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-[140px_1fr_320px] gap-2">
        {/* Thumbnails */}
        <ScrollArea className="border rounded">
          <div className="p-2 space-y-2">
            {thumbnails.map((src, i) => (
              <button key={i} onClick={() => setCurrentPage(i + 1)}
                className={`block w-full rounded border-2 overflow-hidden ${currentPage === i + 1 ? 'border-primary' : 'border-transparent'}`}>
                <img src={src} alt={`Página ${i + 1}`} className="w-full" />
                <div className={`text-[10px] text-center py-0.5 ${searchResults.includes(i + 1) ? 'bg-yellow-100' : ''}`}>
                  {i + 1}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Canvas + overlay */}
        <div ref={containerRef} className="border rounded overflow-auto bg-muted/30">
          <div className="flex items-center justify-between px-3 py-1 border-b bg-background sticky top-0 z-10">
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs">Página {currentPage} / {numPages}</span>
              <Button size="sm" variant="ghost" onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            {tool !== 'select' && (
              <span className="text-xs text-primary">
                Ferramenta: {TOOL_LABELS[tool]}
                {tool === 'magnifier' && ` (passo ${magnifierStep + 1}/2)`}
              </span>
            )}
          </div>
          <div className="p-4 flex justify-center">
            <div className="relative shadow-lg" style={{ width: pageSize.w, height: pageSize.h }}>
              <canvas ref={canvasRef} className="block" />
              <svg
                ref={overlayRef}
                width={pageSize.w} height={pageSize.h}
                className="absolute inset-0"
                style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onClick={() => tool === 'select' && setSelectedId(null)}
              >
                {pageAnnots.map((a) => renderShape(a))}
                {drawing && renderShape({ ...drawing, id: 'drawing', author: '', createdAt: '' } as Annotation, true)}
                {pendingMag && magnifierStep === 1 && (
                  <rect x={nx(pendingMag.src.x)} y={ny(pendingMag.src.y)}
                    width={nx(pendingMag.src.w)} height={ny(pendingMag.src.h)}
                    fill="none" stroke={strokeColor} strokeWidth={2} strokeDasharray="4 3" />
                )}
                {selectedId && (() => {
                  const a = pageAnnots.find((x) => x.id === selectedId);
                  if (!a) return null;
                  const bx = nx(a.x || 0) - 4;
                  const by = ny(a.y || 0) - 4;
                  const bw = Math.max(20, nx(a.w || 0.04)) + 8;
                  const bh = Math.max(20, ny(a.h || 0.04)) + 8;
                  return <rect x={bx} y={by} width={bw} height={bh} fill="none" stroke="#2563eb" strokeWidth={1} strokeDasharray="4 3" pointerEvents="none" />;
                })()}
              </svg>
            </div>
          </div>
        </div>

        {/* Comments panel */}
        <div className="border rounded flex flex-col min-h-0">
          <div className="p-2 border-b flex items-center justify-between">
            <div className="text-sm font-medium">Comentários e Marcações</div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" title="CSV" onClick={() => exportCommentsCsv(annotations, file.name)}>
                <FileText className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" title="PDF" onClick={() => exportCommentsPdf(annotations, file.name)}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="p-2 border-b grid grid-cols-2 gap-1">
            <select className="text-xs border rounded px-1 py-1 bg-background"
              value={filterPage} onChange={(e) => setFilterPage(e.target.value)}>
              <option value="all">Todas as páginas</option>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Página {n}</option>
              ))}
            </select>
            <select className="text-xs border rounded px-1 py-1 bg-background"
              value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">Todos os tipos</option>
              {Object.entries(TOOL_LABELS).filter(([k]) => k !== 'select').map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2 space-y-2">
              {filteredList.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Sem anotações ainda.
                </p>
              )}
              {filteredList.map((a) => (
                <div key={a.id}
                  className={`p-2 rounded border text-xs ${selectedId === a.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium">{TOOL_LABELS[a.type as Tool] || a.type}</span>
                    <span className="text-muted-foreground">Pág. {a.page}</span>
                  </div>
                  {(a.content || a.stampKind) && (
                    <div className="mt-1 text-foreground/80 whitespace-pre-wrap break-words">
                      {a.content || a.stampKind}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {a.author} · {new Date(a.createdAt).toLocaleString('pt-BR')}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                      onClick={() => { setCurrentPage(a.page); setSelectedId(a.id); }}>
                      Ir para
                    </Button>
                    {(a.type === 'comment' || a.type === 'text') && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          const v = window.prompt('Editar texto:', a.content || '');
                          if (v != null) updateAnnotation(a.id, { content: v });
                        }}>
                        Editar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 px-1 text-destructive"
                      onClick={() => deleteAnnotation(a.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          {session.versions.length > 0 && (
            <div className="border-t p-2">
              <div className="text-[11px] font-medium mb-1">Versões salvas</div>
              <div className="space-y-0.5 max-h-24 overflow-auto">
                {session.versions.slice().reverse().map((v) => (
                  <div key={v.versionNumber} className="text-[10px] text-muted-foreground truncate">
                    v{v.versionNumber} · {new Date(v.savedAt).toLocaleString('pt-BR')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comment inline editor */}
      <Dialog open={!!pendingComment} onOpenChange={(o) => !o && setPendingComment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo comentário</DialogTitle></DialogHeader>
          <Textarea autoFocus placeholder="Escreva o comentário…"
            onChange={(e) => pendingComment && updateAnnotation(pendingComment.id, { content: e.target.value })} />
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (pendingComment) deleteAnnotation(pendingComment.id);
              setPendingComment(null);
            }}>Cancelar</Button>
            <Button onClick={() => setPendingComment(null)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingText} onOpenChange={(o) => !o && setPendingText(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Caixa de texto</DialogTitle></DialogHeader>
          <Textarea autoFocus placeholder="Digite o texto…"
            onChange={(e) => pendingText && updateAnnotation(pendingText.id, { content: e.target.value })} />
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (pendingText) deleteAnnotation(pendingText.id);
              setPendingText(null);
            }}>Cancelar</Button>
            <Button onClick={() => setPendingText(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={customStampDialog} onOpenChange={setCustomStampDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo carimbo</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Texto</Label>
            <Input value={newStamp.label} onChange={(e) => setNewStamp({ ...newStamp, label: e.target.value })}
              placeholder="EX.: PROTOCOLADO" />
            <Label>Cor</Label>
            <Input type="color" value={newStamp.color}
              onChange={(e) => setNewStamp({ ...newStamp, color: e.target.value })} className="h-10 w-20 p-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomStampDialog(false)}>Cancelar</Button>
            <Button onClick={addCustomStamp}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}