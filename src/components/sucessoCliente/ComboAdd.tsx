import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  promptLabel?: string;
  transform?: (v: string) => string;
}

export default function ComboAdd({ value, onChange, options, placeholder = 'Selecione', promptLabel = 'Novo valor:', transform }: Props) {
  const add = () => {
    const n = prompt(promptLabel);
    if (!n) return;
    const v = (transform ? transform(n) : n).trim();
    if (!v) return;
    onChange(v);
  };
  const opts = Array.from(new Set([...(options || []), ...(value ? [value] : [])]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return (
    <div className="flex gap-1">
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={placeholder}/></SelectTrigger>
        <SelectContent>
          {opts.length === 0 ? <SelectItem value="__none__" disabled>Nenhum cadastro</SelectItem>
            : opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" onClick={add} title="Adicionar"><Plus className="w-4 h-4"/></Button>
    </div>
  );
}