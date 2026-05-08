import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2, Plus } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { FormSection, FormField, FieldType, newField } from '@/utils/admissao/formSchema';
import FieldEditor from './FieldEditor';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { FIELD_TYPE_LABELS } from '@/utils/admissao/formSchema';

interface Props {
  section: FormSection;
  onChange: (s: FormSection) => void;
  onDelete?: () => void;
}

const SectionEditor = ({ section, onChange, onDelete }: Props) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const updateField = (id: string, f: FormField) => {
    onChange({
      ...section,
      fields: section.fields.map((x) => (x.id === id ? f : x)),
    });
  };
  const deleteField = (id: string) => {
    onChange({ ...section, fields: section.fields.filter((x) => x.id !== id) });
  };
  const addField = (type: FieldType) => {
    onChange({ ...section, fields: [...section.fields, newField(type)] });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = section.fields.findIndex((f) => f.id === active.id);
    const newIdx = section.fields.findIndex((f) => f.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onChange({ ...section, fields: arrayMove(section.fields, oldIdx, newIdx) });
  };

  const fieldTypes: FieldType[] = [
    'short_text','long_text','number','date','email','phone','cpf','cep',
    'dropdown','radio','checkbox','file','work_schedule',
  ];

  return (
    <div className="border-2 border-primary/20 rounded-lg p-4 space-y-3 bg-background">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <div>
            <Label className="text-xs">Título da seção</Label>
            <Input
              value={section.title}
              onChange={(e) => onChange({ ...section, title: e.target.value })}
              placeholder="Ex: Dados pessoais"
            />
          </div>
          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Textarea
              value={section.description || ''}
              onChange={(e) => onChange({ ...section, description: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={section.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {section.fields.map((f) => (
              <FieldEditor
                key={f.id}
                field={f}
                onChange={(nf) => updateField(f.id, nf)}
                onDelete={() => deleteField(f.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1" /> Adicionar pergunta
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {fieldTypes.map((t) => (
            <DropdownMenuItem key={t} onClick={() => addField(t)}>
              {FIELD_TYPE_LABELS[t]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default SectionEditor;