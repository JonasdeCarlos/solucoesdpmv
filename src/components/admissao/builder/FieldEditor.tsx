import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, GripVertical, Plus, X } from 'lucide-react';
import { FormField, FieldType, FIELD_TYPE_LABELS, slugify } from '@/utils/admissao/formSchema';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  field: FormField;
  onChange: (f: FormField) => void;
  onDelete: () => void;
}

const TYPES: FieldType[] = [
  'short_text','long_text','number','date','email','phone','cpf','cep',
  'dropdown','radio','checkbox','file','work_schedule',
];

const FieldEditor = ({ field, onChange, onDelete }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const update = (patch: Partial<FormField>) => onChange({ ...field, ...patch });

  const updateOption = (idx: number, label: string) => {
    const opts = [...(field.options || [])];
    opts[idx] = { ...opts[idx], label };
    update({ options: opts });
  };
  const addOption = () => {
    const opts = [...(field.options || []), { id: crypto.randomUUID(), label: `Opção ${(field.options?.length || 0) + 1}` }];
    update({ options: opts });
  };
  const removeOption = (idx: number) => {
    const opts = [...(field.options || [])];
    opts.splice(idx, 1);
    update({ options: opts });
  };

  const hasOptions = field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox';
  const isFile = field.type === 'file';

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg bg-card p-4 space-y-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-2 text-muted-foreground hover:text-foreground cursor-grab"
          aria-label="Arrastar"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 grid gap-2 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Pergunta</Label>
            <Input
              value={field.label}
              onChange={(e) => {
                const label = e.target.value;
                update({ label, field_key: slugify(label) || field.field_key });
              }}
              placeholder="Título da pergunta"
            />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={field.type} onValueChange={(v) => update({ type: v as FieldType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div>
        <Label className="text-xs">Descrição/ajuda (opcional)</Label>
        <Textarea
          value={field.description || ''}
          onChange={(e) => update({ description: e.target.value })}
          rows={2}
        />
      </div>

      {hasOptions && (
        <div className="space-y-2">
          <Label className="text-xs">Alternativas</Label>
          {(field.options || []).map((opt, i) => (
            <div key={opt.id} className="flex gap-2">
              <Input
                value={opt.label}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Opção ${i + 1}`}
              />
              <Button variant="ghost" size="sm" onClick={() => removeOption(i)} className="h-9 w-9 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addOption}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar opção
          </Button>
        </div>
      )}

      {isFile && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center gap-2">
            <Switch checked={!!field.multiple} onCheckedChange={(v) => update({ multiple: v })} />
            <Label className="text-xs">Múltiplos arquivos</Label>
          </div>
          <div>
            <Label className="text-xs">Tamanho máx (MB)</Label>
            <Input
              type="number"
              value={field.max_size_mb ?? 20}
              onChange={(e) => update({ max_size_mb: parseInt(e.target.value) || 20 })}
              min={1}
              max={100}
            />
          </div>
          <div>
            <Label className="text-xs">Formatos (separe por vírgula)</Label>
            <Input
              value={(field.accept || []).join(', ')}
              onChange={(e) => update({
                accept: e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
              })}
              placeholder="pdf, jpg, png, heic"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Switch checked={field.required} onCheckedChange={(v) => update({ required: v })} />
        <Label className="text-xs">Obrigatório</Label>
        <span className="ml-auto text-xs text-muted-foreground">chave: <code>{field.field_key}</code></span>
      </div>
    </div>
  );
};

export default FieldEditor;