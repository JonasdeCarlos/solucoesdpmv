import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Copy, Trash2, FileText, Link2, MessageCircle } from 'lucide-react';
import { useAdmissaoTemplates } from '@/hooks/useAdmissaoTemplates';
import { toast } from 'sonner';

const FormulariosListPage = () => {
  const { templates, loading, create, duplicate, remove } = useAdmissaoTemplates();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return toast.error('Informe um nome');
    const { data, error } = await create(name.trim());
    if (error) return toast.error('Erro ao criar');
    setOpen(false);
    setName('');
    if (data) window.location.href = `/admissao/escritorio/formularios/${data.id}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Formulários de Admissão</h2>
          <p className="text-sm text-muted-foreground">
            Modele os campos que o cliente preencherá durante a admissão.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> Novo formulário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo formulário</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="n">Nome</Label>
              <Input id="n" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Admissão padrão" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && templates.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum formulário criado ainda.</p>
        </Card>
      )}

      <div className="grid gap-3">
        {templates.map((t) => (
          <Card key={t.id} className="p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{t.name}</h3>
                <Badge variant={t.is_published ? 'default' : 'secondary'}>
                  {t.is_published ? 'Publicado' : 'Rascunho'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.schema_json.sections.length} seção(ões) ·{' '}
                {t.schema_json.sections.reduce((a, s) => a + s.fields.length, 0)} pergunta(s)
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to={`/admissao/escritorio/formularios/${t.id}`}>
                <Edit className="w-4 h-4 mr-1" /> Editar
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!t.is_published}
              title={t.is_published ? 'Copiar link público' : 'Publique o formulário para gerar o link'}
              onClick={async () => {
                const PUBLISHED = 'https://calculo-clt-agora.lovable.app';
                const origin = window.location.hostname.includes('id-preview--') ||
                  window.location.hostname.includes('lovableproject.com')
                  ? PUBLISHED
                  : window.location.origin;
                const url = `${origin}/admissao/publico/${t.id}`;
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success('Link público copiado!');
                } catch {
                  toast.message('Copie o link', { description: url });
                }
              }}
            >
              <Link2 className="w-4 h-4 mr-1" /> Link público
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!t.is_published}
              title={t.is_published ? 'Copiar texto para WhatsApp' : 'Publique o formulário para gerar o texto'}
              onClick={async () => {
                const PUBLISHED = 'https://calculo-clt-agora.lovable.app';
                const origin = window.location.hostname.includes('id-preview--') ||
                  window.location.hostname.includes('lovableproject.com')
                  ? PUBLISHED
                  : window.location.origin;
                const url = `${origin}/admissao/publico/${t.id}`;
                const text = `Prezado Cliente,\n\nPara que o processo de admissão seja realizado sem divergências, pedimos gentilmente para que se preencha o formulário abaixo preenchendo de forma íntegra todos os campos obrigatórios.\n\nAgradecemos a colaboração.\n\n${url}\n\nQualquer dúvida estamos à disposição.\n\nAtenciosamente,\n\nDepartamento Pessoal\nMonte Verde Contabilidade`;
                try {
                  await navigator.clipboard.writeText(text);
                  toast.success('Texto para WhatsApp copiado!');
                } catch {
                  toast.message('Copie o texto', { description: text });
                }
              }}
            >
              <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={() => duplicate(t.id)}>
              <Copy className="w-4 h-4 mr-1" /> Duplicar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={async () => {
                if (!confirm(`Excluir "${t.name}"?`)) return;
                await remove(t.id);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FormulariosListPage;