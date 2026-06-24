import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Loader2, ArrowLeft, MessageSquare, Trash2, History, Save, BookmarkPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAvisoEmpresas } from '@/hooks/useAvisoEmpresas';
import { formatCnpj } from '@/utils/avisos/normalize';

interface MensagemHist {
  id: string;
  empresa_id: string;
  empresa_code: string | null;
  empresa_name: string | null;
  mensagem: string;
  sucesso: boolean;
  erro: string | null;
  created_at: string;
}

interface Modelo {
  id: string;
  titulo: string;
  texto: string;
  updated_at: string;
}

const MensageriaPage = () => {
  const { empresas, loading } = useAvisoEmpresas();
  const [mensagem, setMensagem] = useState('');
  const [q, setQ] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [historico, setHistorico] = useState<MensagemHist[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [savingModelo, setSavingModelo] = useState(false);

  const refreshHist = useCallback(async () => {
    setLoadingHist(true);
    const { data } = await supabase
      .from('aviso_mensagens_enviadas' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setHistorico((data as any) || []);
    setLoadingHist(false);
  }, []);

  const refreshModelos = useCallback(async () => {
    const { data } = await supabase
      .from('aviso_mensagens_modelos' as any)
      .select('*')
      .order('updated_at', { ascending: false });
    setModelos((data as any) || []);
  }, []);

  useEffect(() => { refreshHist(); refreshModelos(); }, [refreshHist, refreshModelos]);

  const carregarModelo = (id: string) => {
    if (id === '__new__') { setModeloId(null); setMensagem(''); return; }
    const m = modelos.find((x) => x.id === id);
    if (!m) return;
    setModeloId(m.id);
    setMensagem(m.texto);
  };

  const salvarModelo = async () => {
    const texto = mensagem.trim();
    if (!texto) { toast.error('Digite a mensagem antes de salvar.'); return; }
    setSavingModelo(true);
    try {
      if (modeloId) {
        const { error } = await supabase
          .from('aviso_mensagens_modelos' as any)
          .update({ texto } as any)
          .eq('id', modeloId);
        if (error) throw error;
        toast.success('Modelo atualizado.');
      } else {
        const titulo = (prompt('Nome do modelo:', texto.slice(0, 40)) || '').trim();
        if (!titulo) { setSavingModelo(false); return; }
        const { data: user } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('aviso_mensagens_modelos' as any)
          .insert({ titulo, texto, criado_por: user?.user?.id ?? null } as any)
          .select()
          .single();
        if (error) throw error;
        setModeloId((data as any)?.id ?? null);
        toast.success('Modelo salvo.');
      }
      refreshModelos();
    } catch (e) {
      toast.error('Falha ao salvar: ' + (e as Error).message);
    } finally {
      setSavingModelo(false);
    }
  };

  const excluirModelo = async () => {
    if (!modeloId) return;
    if (!confirm('Excluir este modelo?')) return;
    const { error } = await supabase.from('aviso_mensagens_modelos' as any).delete().eq('id', modeloId);
    if (error) { toast.error('Falha ao excluir.'); return; }
    setModeloId(null);
    setMensagem('');
    refreshModelos();
  };

  const filt = useMemo(
    () => empresas.filter((e) =>
      !q || `${e.code} ${e.name} ${e.cnpj} ${(e.whatsapp_numeros || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())
    ),
    [empresas, q],
  );

  const enviar = async (empresaId: string, empresaName: string) => {
    const texto = mensagem.trim();
    if (!texto) { toast.error('Digite a mensagem antes de enviar.'); return; }
    if (texto.length > 4000) { toast.error('Mensagem muito longa (máx. 4000).'); return; }
    setSendingId(empresaId);
    const empresa = empresas.find((e) => e.id === empresaId);
    let sucesso = false;
    let erroMsg: string | null = null;
    try {
      const { data, error } = await supabase.functions.invoke('avisos-digisac-mensagem', {
        body: { empresa_id: empresaId, mensagem: texto },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.erro) throw new Error(String((data as any).erro));
      sucesso = true;
      setSentIds((prev) => new Set(prev).add(empresaId));
      toast.success(`Enviado para ${empresaName}.`);
    } catch (e) {
      erroMsg = (e as Error).message;
      toast.error(`Falha ao enviar para ${empresaName}: ${(e as Error).message}`);
    } finally {
      setSendingId(null);
    }
    // Registra no histórico (sucesso e falha)
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('aviso_mensagens_enviadas' as any).insert({
      empresa_id: empresaId,
      empresa_code: empresa?.code ?? null,
      empresa_name: empresa?.name ?? empresaName,
      mensagem: texto,
      sucesso,
      erro: erroMsg,
      enviado_por: user?.user?.id ?? null,
    } as any);
    refreshHist();
  };

  const excluirHist = async (id: string) => {
    if (!confirm('Excluir este registro do histórico?')) return;
    const { error } = await supabase.from('aviso_mensagens_enviadas' as any).delete().eq('id', id);
    if (error) { toast.error('Falha ao excluir.'); return; }
    setHistorico((h) => h.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link to="/avisos"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button></Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6" />Mensageria</h1>
        </div>
        <Badge variant="outline">Envio individual via Digisac</Badge>
      </div>

      <Card className="p-4 space-y-3">
        <div>
          <label className="text-sm font-medium">Mensagem</label>
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Digite a mensagem que será enviada individualmente para cada empresa..."
            rows={6}
            maxLength={4000}
            className="mt-1"
          />
          <div className="text-xs text-muted-foreground mt-1 flex justify-between">
            <span>Para evitar bloqueio por spam, o envio é manual — um clique por empresa.</span>
            <span>{mensagem.length}/4000</span>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <Input
            placeholder="Filtrar empresa por código, nome, CNPJ ou número..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-md"
          />
          <div className="text-sm text-muted-foreground">
            {sentIds.size} enviada{sentIds.size === 1 ? '' : 's'} · {filt.length} listada{filt.length === 1 ? '' : 's'}
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Empresa</th>
                  <th className="py-2 pr-3">CNPJ</th>
                  <th className="py-2 pr-3">WhatsApp</th>
                  <th className="py-2 pr-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filt.map((e) => {
                  const sent = sentIds.has(e.id);
                  const hasDest = !!e.digisac_contact_id || (e.whatsapp_numeros || []).some(Boolean) || !!e.whatsapp;
                  return (
                    <tr key={e.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 pr-3 font-mono">{e.code}</td>
                      <td className="py-2 pr-3">{e.name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{formatCnpj(e.cnpj)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {(e.whatsapp_numeros || []).filter(Boolean).join(', ') || e.whatsapp || '—'}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {!hasDest ? (
                          <span className="text-xs text-destructive">Sem destino</span>
                        ) : (
                          <Button
                            size="sm"
                            variant={sent ? 'outline' : 'default'}
                            disabled={sendingId === e.id || !mensagem.trim()}
                            onClick={() => enviar(e.id, e.name)}
                          >
                            {sendingId === e.id ? (
                              <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enviando</>
                            ) : sent ? (
                              <><Send className="h-4 w-4 mr-1" />Reenviar</>
                            ) : (
                              <><Send className="h-4 w-4 mr-1" />Enviar</>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filt.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhuma empresa.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" />Histórico de envios</h2>
          <div className="text-sm text-muted-foreground">{historico.length} registro{historico.length === 1 ? '' : 's'}</div>
        </div>
        {loadingHist ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : historico.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma mensagem enviada ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Empresa</th>
                  <th className="py-2 pr-3">Mensagem</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {historico.map((m) => (
                  <tr key={m.id} className="border-b align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                      {new Date(m.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-mono text-xs text-muted-foreground">{m.empresa_code}</div>
                      <div>{m.empresa_name}</div>
                    </td>
                    <td className="py-2 pr-3 max-w-[480px] whitespace-pre-wrap">{m.mensagem}</td>
                    <td className="py-2 pr-3">
                      {m.sucesso ? (
                        <Badge className="bg-green-500/15 text-green-700 border-green-500/30" variant="outline">Enviada</Badge>
                      ) : (
                        <Badge variant="destructive" title={m.erro || ''}>Falha</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => excluirHist(m.id)} title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MensageriaPage;