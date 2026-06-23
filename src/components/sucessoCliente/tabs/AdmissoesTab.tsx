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
import { supabase } from '@/integrations/supabase/client';

export default function AdmissoesTab({ client_id }: { client_id: string }) {
  const { profile, upsert } = useDPProfile(client_id);
  const [form, setForm] = useState<DPProfile>(emptyProfile(client_id));
  const [sstSuggestions, setSstSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (profile) setForm({ ...emptyProfile(client_id), ...profile });
  }, [profile, client_id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('client_dp_profile')
        .select('sst_empresa');
      const set = new Set<string>();
      (data || []).forEach((r: any) => {
        const v = (r?.sst_empresa || '').trim();
        if (v) set.add(v);
      });
      setSstSuggestions(Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR')));
    })();
  }, []);

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SST — Saúde e Segurança do Trabalho</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Empresa responsável pela SST</Label>
            <Input
              list="sst-empresa-sugestoes"
              value={form.sst_empresa}
              onChange={(e) => set('sst_empresa', e.target.value)}
              placeholder="Selecione ou digite o nome da empresa de SST"
              autoComplete="off"
            />
            <datalist id="sst-empresa-sugestoes">
              {sstSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground mt-1">
              Sugestões baseadas em empresas de SST já cadastradas em outros clientes.
            </p>
          </div>
          <div>
            <Label>Pessoa de contato</Label>
            <Input
              value={form.sst_contato_nome}
              onChange={(e) => set('sst_contato_nome', e.target.value)}
            />
          </div>
          <div>
            <Label>Telefone / WhatsApp</Label>
            <Input
              value={form.sst_contato_telefone}
              onChange={(e) => set('sst_contato_telefone', e.target.value)}
              placeholder="(35) 99999-9999"
            />
          </div>
          <div className="md:col-span-2">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.sst_contato_email}
              onChange={(e) => set('sst_contato_email', e.target.value)}
              placeholder="contato@sst.com.br"
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