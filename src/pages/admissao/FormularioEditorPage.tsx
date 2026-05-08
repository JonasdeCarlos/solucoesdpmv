import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Plus, Eye, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import SectionEditor from '@/components/admissao/builder/SectionEditor';
import { getTemplateById, useAdmissaoTemplates, AdmissionTemplate } from '@/hooks/useAdmissaoTemplates';
import { FormSchema, FormSection } from '@/utils/admissao/formSchema';
import { toast } from 'sonner';
import FieldRenderer from '@/components/admissao/preencher/FieldRenderer';
import WorkScheduleField from '@/components/admissao/preencher/WorkScheduleField';

const FormularioEditorPage = () => {
  const { id = '' } = useParams();
  const { update } = useAdmissaoTemplates();
  const [tpl, setTpl] = useState<AdmissionTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    getTemplateById(id).then((t) => setTpl(t));
  }, [id]);

  if (!tpl) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const setSchema = (schema: FormSchema) => setTpl({ ...tpl, schema_json: schema });

  const updateSection = (idx: number, s: FormSection) => {
    const sections = [...tpl.schema_json.sections];
    sections[idx] = s;
    setSchema({ sections });
  };
  const deleteSection = (idx: number) => {
    if (tpl.schema_json.sections.length <= 1) return toast.error('Mantenha ao menos uma seção');
    const sections = tpl.schema_json.sections.filter((_, i) => i !== idx);
    setSchema({ sections });
  };
  const addSection = () => {
    setSchema({
      sections: [
        ...tpl.schema_json.sections,
        { id: crypto.randomUUID(), title: `Seção ${tpl.schema_json.sections.length + 1}`, description: '', fields: [] },
      ],
    });
  };

  const save = async () => {
    setBusy(true);
    const { error } = await update(tpl.id, {
      name: tpl.name,
      description: tpl.description,
      is_published: tpl.is_published,
      schema_json: tpl.schema_json,
    });
    setBusy(false);
    if (error) toast.error('Erro ao salvar');
    else toast.success('Salvo');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admissao/escritorio/formularios"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => setPreview(true)}>
          <Eye className="w-4 h-4 mr-1" /> Pré-visualizar
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Salvar
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <div>
          <Label>Nome do formulário</Label>
          <Input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} />
        </div>
        <div>
          <Label>Descrição (opcional)</Label>
          <Textarea value={tpl.description} onChange={(e) => setTpl({ ...tpl, description: e.target.value })} rows={2} />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Switch checked={tpl.is_published} onCheckedChange={(v) => setTpl({ ...tpl, is_published: v })} />
          <Label>Publicado (disponível para criar admissões)</Label>
        </div>
      </Card>

      <div className="space-y-3">
        {tpl.schema_json.sections.map((s, i) => (
          <SectionEditor
            key={s.id}
            section={s}
            onChange={(ns) => updateSection(i, ns)}
            onDelete={tpl.schema_json.sections.length > 1 ? () => deleteSection(i) : undefined}
          />
        ))}
      </div>

      <Button variant="outline" onClick={addSection}>
        <Plus className="w-4 h-4 mr-1" /> Adicionar seção
      </Button>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pré-visualização</DialogTitle></DialogHeader>
          <div className="space-y-6">
            {tpl.schema_json.sections.map((sec) => (
              <div key={sec.id} className="space-y-3">
                <div>
                  <h3 className="font-bold text-lg">{sec.title}</h3>
                  {sec.description && <p className="text-sm text-muted-foreground">{sec.description}</p>}
                </div>
                {sec.fields.map((f) => (
                  f.type === 'work_schedule' ? (
                    <WorkScheduleField key={f.id} field={f} value={undefined} onChange={() => {}} />
                  ) : (
                    <FieldRenderer key={f.id} field={f} value="" onChange={() => {}} />
                  )
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormularioEditorPage;