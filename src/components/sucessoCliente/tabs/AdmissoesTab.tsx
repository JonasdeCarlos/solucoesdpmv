import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useDPProfile } from '@/hooks/useSucessoCliente';
import { emptyProfile, type DPProfile } from '@/types/sucessoCliente';
import { toast } from 'sonner';

export default function AdmissoesTab({ client_id }: { client_id: string }) {
  const { profile, upsert } = useDPProfile(client_id);
  const [form, setForm] = useState<DPProfile>(emptyProfile(client_id));

  useEffect(() => {
    if (profile) setForm({ ...emptyProfile(client_id), ...profile });
  }, [profile, client_id]);

  const set = (k: keyof DPProfile, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const { error } = await upsert(form);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    toast.success('Admissões salvas.');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admissões</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Modelo de contrato utilizado</Label>
            <Input
              value={form.admissao_modelo_contrato}
              onChange={(e) => set('admissao_modelo_contrato', e.target.value)}
              placeholder="Ex.: CLT Padrão, Experiência 45+45, Intermitente…"
            />
          </div>
          <div>
            <Label>Caminho do contrato no sistema Domínio</Label>
            <Input
              value={form.admissao_caminho_dominio}
              onChange={(e) => set('admissao_caminho_dominio', e.target.value)}
              placeholder="Ex.: Folha &gt; Cadastros &gt; Modelos &gt; Contrato XYZ"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Cláusulas específicas utilizadas</Label>
            <Textarea
              rows={8}
              value={form.admissao_clausulas_especificas}
              onChange={(e) => set('admissao_clausulas_especificas', e.target.value)}
              placeholder="Liste cláusulas customizadas (ex.: confidencialidade, exclusividade, banco de horas, teletrabalho, etc.)"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}><Save className="w-4 h-4 mr-1"/>Salvar admissões</Button>
      </div>
    </div>
  );
}