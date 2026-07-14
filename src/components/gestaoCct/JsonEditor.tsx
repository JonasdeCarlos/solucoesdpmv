import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

function humanize(k: string) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  value: any;
  onChange: (v: any) => void;
  disabled?: boolean;
  depth?: number;
}

export function JsonEditor({ value, onChange, disabled, depth = 0 }: Props) {
  if (value === null || value === undefined) {
    return (
      <Input value="" onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="—" />
    );
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const str = String(value);
    if (str.length > 80 || str.includes('\n')) {
      return <Textarea value={str} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="min-h-[70px]" />;
    }
    return <Input value={str} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
  }
  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="border rounded-md p-2 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
              {!disabled && (
                <Button size="sm" variant="ghost" onClick={() => {
                  const next = [...value]; next.splice(i, 1); onChange(next);
                }}><Trash2 className="w-3 h-3" /></Button>
              )}
            </div>
            <JsonEditor value={item} disabled={disabled} depth={depth + 1} onChange={(nv) => {
              const next = [...value]; next[i] = nv; onChange(next);
            }} />
          </div>
        ))}
        {!disabled && (
          <Button size="sm" variant="outline" onClick={() => {
            const template = value.length > 0 && typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])
              ? Object.fromEntries(Object.keys(value[0]).map((k) => [k, '']))
              : '';
            onChange([...value, template]);
          }}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
        )}
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    return (
      <div className={depth === 0 ? 'space-y-3' : 'space-y-2 pl-2 border-l'}>
        {entries.map(([k, v]) => (
          <div key={k} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{humanize(k)}</label>
            <JsonEditor value={v} disabled={disabled} depth={depth + 1} onChange={(nv) => {
              onChange({ ...value, [k]: nv });
            }} />
          </div>
        ))}
      </div>
    );
  }
  return null;
}