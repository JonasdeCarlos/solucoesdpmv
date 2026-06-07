import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Save, Plus } from 'lucide-react';
import { useDPProfile } from '@/hooks/useSucessoCliente';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { emptyProfile, type DPProfile, type ClienteDP } from '@/types/sucessoCliente';
import { toast } from 'sonner';
import ComboAdd from '@/components/sucessoCliente/ComboAdd';

export default function PerfilTab({ cliente, onClienteSaved }: { cliente: ClienteDP; onClienteSaved: () => void }) {
  const { profile, upsert } = useDPProfile(cliente.id);
  const { isAdmin } = useUserRole();
  const [form, setForm] = useState<DPProfile>(emptyProfile(cliente.id));
  const [cli, setCli] = useState(cliente);
  const [pwd, setPwd] = useState('');
  const [pwdLoaded, setPwdLoaded] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [segmentos, setSegmentos] = useState<string[]>([]);
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [ufs, setUfs] = useState<string[]>([]);
  const [gestores, setGestores] = useState<string[]>([]);
  const [horarios, setHorarios] = useState<string[]>([]);

  const loadSegmentos = async () => {
    const { data } = await supabase.from('dp_segmentos' as any).select('nome').order('nome');
    setSegmentos(((data as any[]) || []).map((d) => d.nome));
  };
  const loadDistincts = async () => {
    const { data } = await supabase.from('clientes' as any).select('municipio, uf, gestor_carteira');
    const m = new Set<string>(), u = new Set<string>(), g = new Set<string>();
    ((data as any[]) || []).forEach((r) => {
      if (r.municipio) m.add(r.municipio);
      if (r.uf) u.add(r.uf);
      if (r.gestor_carteira) g.add(r.gestor_carteira);
    });
    setMunicipios(Array.from(m));
    setUfs(Array.from(u));
    setGestores(Array.from(g));
    const { data: p } = await supabase.from('client_dp_profile' as any).select('best_contact_time');
    const h = new Set<string>();
    ((p as any[]) || []).forEach((r) => { if (r.best_contact_time) h.add(r.best_contact_time); });
    setHorarios(Array.from(h));
  };
  useEffect(() => { loadSegmentos(); loadDistincts(); }, []);

  const addSegmento = async () => {
    const n = prompt('Novo segmento:');
    if (!n) return;
    const nome = n.trim();
    if (!nome) return;
    const { error } = await supabase.from('dp_segmentos' as any).insert({ nome } as any);
    if (error && !String(error.message).includes('duplicate')) { toast.error(error.message); return; }
    await loadSegmentos();
    setCli((c) => ({ ...c, segmento: nome }));
  };

  useEffect(() => {
    if (profile) setForm({ ...emptyProfile(cliente.id), ...profile });
  }, [profile, cliente.id]);

  useEffect(() => setCli(cliente), [cliente]);

  const set = (k: keyof DPProfile, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const loadPwd = async () => {
    const { data, error } = await supabase.rpc('get_timeclock_password' as any, { _client_id: cliente.id } as any);
    if (error) { toast.error('Sem permissão para ver a senha.'); return; }
    setPwd((data as any) || ''); setPwdLoaded(true); setShowPwd(true);
  };

  const saveAll = async () => {
    const { error: e1 } = await supabase.from('clientes' as any).update({
      nome: cli.nome, codigo_cliente: cli.codigo_cliente || null, nome_fantasia: cli.nome_fantasia,
      cnpj: cli.cnpj, cpf: cli.cpf, tipo: cli.tipo, municipio: cli.municipio, uf: cli.uf, segmento: cli.segmento,
      contato_nome: cli.contato_nome, contato_telefone: cli.contato_telefone, contato_email: cli.contato_email, status: cli.status, endereco: cli.endereco,
      gestor_carteira: cli.gestor_carteira || '',
      tipo_folha: cli.tipo_folha || null,
    } as any).eq('id', cliente.id);
    if (e1) { toast.error('Erro ao salvar cliente: ' + e1.message); return; }
    const { error: e2 } = await upsert(form);
    if (e2) { toast.error('Erro ao salvar perfil: ' + e2.message); return; }
    if (pwdLoaded && isAdmin) {
      await supabase.rpc('set_timeclock_password' as any, { _client_id: cliente.id, _password: pwd } as any);
    }
    toast.success('Salvo.');
    onClienteSaved();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Código</Label><Input value={cli.codigo_cliente || ''} onChange={(e)=>setCli({...cli, codigo_cliente: e.target.value})}/></div>
          <div className="md:col-span-2"><Label>Razão Social *</Label><Input value={cli.nome} onChange={(e)=>setCli({...cli, nome: e.target.value})}/></div>
          <div><Label>Nome Fantasia</Label><Input value={cli.nome_fantasia} onChange={(e)=>setCli({...cli, nome_fantasia: e.target.value})}/></div>
          <div><Label>Tipo</Label>
            <Select value={cli.tipo} onValueChange={(v)=>setCli({...cli, tipo: v as any})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="PJ">PJ</SelectItem><SelectItem value="PF">PF</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>{cli.tipo === 'PJ' ? 'CNPJ' : 'CPF'}</Label>
            <Input value={cli.tipo === 'PJ' ? cli.cnpj : cli.cpf} onChange={(e)=>cli.tipo === 'PJ' ? setCli({...cli, cnpj: e.target.value}) : setCli({...cli, cpf: e.target.value})}/>
          </div>
          <div><Label>Município</Label>
            <ComboAdd value={cli.municipio} onChange={(v)=>setCli({...cli, municipio: v})} options={municipios} promptLabel="Novo município:"/>
          </div>
          <div><Label>UF</Label>
            <ComboAdd value={cli.uf} onChange={(v)=>setCli({...cli, uf: v.toUpperCase()})} options={ufs} promptLabel="Nova UF (sigla):" transform={(v)=>v.toUpperCase().slice(0,2)}/>
          </div>
          <div><Label>Segmento</Label>
            <div className="flex gap-1">
              <Select value={cli.segmento || ''} onValueChange={(v)=>setCli({...cli, segmento: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                <SelectContent>
                  {segmentos.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={addSegmento} title="Adicionar segmento"><Plus className="w-4 h-4"/></Button>
            </div>
          </div>
          <div><Label>Tipo da Folha</Label>
            <Select value={cli.tipo_folha || ''} onValueChange={(v)=>setCli({...cli, tipo_folha: v})}>
              <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="pro_labore">Somente Pró-labore</SelectItem>
                <SelectItem value="folha_sem_variaveis">Folha sem variáveis</SelectItem>
                <SelectItem value="folha_com_variaveis">Folha com variáveis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Status</Label>
            <Select value={cli.status} onValueChange={(v)=>setCli({...cli, status: v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Contato — Nome</Label><Input value={cli.contato_nome} onChange={(e)=>setCli({...cli, contato_nome: e.target.value})}/></div>
          <div><Label>Contato — Telefone</Label><Input value={cli.contato_telefone} onChange={(e)=>setCli({...cli, contato_telefone: e.target.value})}/></div>
          <div><Label>Contato — E-mail</Label><Input value={cli.contato_email} onChange={(e)=>setCli({...cli, contato_email: e.target.value})}/></div>
          <div><Label>Gestor da Carteira</Label>
            <ComboAdd value={cli.gestor_carteira || ''} onChange={(v)=>setCli({...cli, gestor_carteira: v})} options={gestores} promptLabel="Novo gestor:"/>
          </div>
          <div className="md:col-span-3"><Label>Endereço</Label><Input value={cli.endereco} onChange={(e)=>setCli({...cli, endereco: e.target.value})}/></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Comunicação / Atendimento</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Digisac — Nome do contato</Label><Input value={form.digisac_contact_name} onChange={(e)=>set('digisac_contact_name', e.target.value)}/></div>
          <div><Label>Digisac — ID/identificador</Label><Input value={form.digisac_contact_id} onChange={(e)=>set('digisac_contact_id', e.target.value)}/></div>
          <div><Label>Canal padrão</Label>
            <Select value={form.channel_default} onValueChange={(v)=>set('channel_default', v)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="digisac">Digisac</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Melhor horário</Label>
            <ComboAdd value={form.best_contact_time} onChange={(v)=>set('best_contact_time', v)} options={horarios} promptLabel="Novo horário (ex.: 09h-12h):"/>
          </div>
          <div><Label>SLA (horas)</Label><Input type="number" value={form.sla_hours} onChange={(e)=>set('sla_hours', Number(e.target.value))}/></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ponto / Jornada</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={form.has_timeclock} onCheckedChange={(v)=>set('has_timeclock', v)}/>
            <Label>Possui ponto?</Label>
          </div>
          {form.has_timeclock && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-2 border-l-2 border-primary/30">
              <div><Label>Tipo</Label>
                <Select value={form.timeclock_type} onValueChange={(v)=>set('timeclock_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eletronico">Eletrônico</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.timeclock_type === 'eletronico' && <>
                <div><Label>Quem trata?</Label>
                  <Select value={form.timeclock_owner} onValueChange={(v)=>set('timeclock_owner', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="escritorio">Escritório</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>URL de acesso</Label><Input value={form.timeclock_url} onChange={(e)=>set('timeclock_url', e.target.value)}/></div>
                <div><Label>Usuário</Label><Input value={form.timeclock_user} onChange={(e)=>set('timeclock_user', e.target.value)}/></div>
                <div>
                  <Label>Senha {!isAdmin && <span className="text-xs text-muted-foreground">(somente admin)</span>}</Label>
                  <div className="flex gap-1">
                    <Input type={showPwd ? 'text' : 'password'} value={pwd} onChange={(e)=>{setPwd(e.target.value); setPwdLoaded(true);}} placeholder={isAdmin ? (pwdLoaded ? '' : '•••• (clique para carregar)') : 'restrito'} disabled={!isAdmin}/>
                    {isAdmin && <Button type="button" variant="outline" size="icon" onClick={() => pwdLoaded ? setShowPwd(s=>!s) : loadPwd()}>{showPwd ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</Button>}
                  </div>
                </div>
                <div className="md:col-span-3"><Label>Observações de acesso</Label><Textarea value={form.timeclock_notes} onChange={(e)=>set('timeclock_notes', e.target.value)}/></div>
              </>}
              {form.timeclock_type === 'manual' && <>
                <div className="md:col-span-2"><Label>Como o cliente envia</Label><Input value={form.manual_send_method} onChange={(e)=>set('manual_send_method', e.target.value)}/></div>
                <div><Label>Frequência</Label>
                  <Select value={form.manual_send_frequency} onValueChange={(v)=>set('manual_send_frequency', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diario">Diário</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="competencia">Por competência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>}
            </div>
          )}
          {!form.has_timeclock && (
            <div className="pl-2 border-l-2 border-primary/30 space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={form.has_variables} onCheckedChange={(v)=>set('has_variables', v)}/>
                <Label>Possui variáveis?</Label>
              </div>
              {form.has_variables && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><Label>Como envia</Label>
                    <Select value={form.variables_how} onValueChange={(v)=>set('variables_how', v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planilha">Planilha</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="sistema">Sistema</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Data limite (dia)</Label><Input type="number" min={1} max={31} value={form.variables_deadline_day ?? ''} onChange={(e)=>set('variables_deadline_day', e.target.value ? Number(e.target.value) : null)}/></div>
                  <div><Label>Responsável no cliente</Label><Input value={form.variables_responsible} onChange={(e)=>set('variables_responsible', e.target.value)}/></div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Prévia da Folha</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3"><Switch checked={form.needs_preview} onCheckedChange={(v)=>set('needs_preview', v)}/><Label>Necessita envio de prévia?</Label></div>
          {form.needs_preview && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label>Prazo de envio (dia)</Label><Input type="number" min={1} max={31} value={form.preview_deadline_day ?? ''} onChange={(e)=>set('preview_deadline_day', e.target.value ? Number(e.target.value) : null)}/></div>
              <div><Label>Canal</Label>
                <Select value={form.preview_channel} onValueChange={(v)=>set('preview_channel', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3"><Label>Regras do que entra na prévia</Label><Textarea value={form.preview_rules} onChange={(e)=>set('preview_rules', e.target.value)}/></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Carga Horária</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Tipo</Label>
            <Select value={form.workload_type} onValueChange={(v)=>set('workload_type', v)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.workload_type === 'fixa' ? (
            <div><Label>Jornada (HH:MM)</Label><Input value={form.workload_hhmm} onChange={(e)=>set('workload_hhmm', e.target.value)} placeholder="ex.: 07:20"/></div>
          ) : (
            <div className="md:col-span-2"><Label>Regra de apuração</Label><Textarea value={form.workload_rules} onChange={(e)=>set('workload_rules', e.target.value)}/></div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end sticky bottom-2">
        <Button onClick={saveAll} size="lg" className="shadow-lg"><Save className="w-4 h-4 mr-1"/>Salvar perfil</Button>
      </div>
    </div>
  );
}