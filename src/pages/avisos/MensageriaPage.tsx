import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Loader2, ArrowLeft, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAvisoEmpresas } from '@/hooks/useAvisoEmpresas';
import { formatCnpj } from '@/utils/avisos/normalize';

const MensageriaPage = () => {
  const { empresas, loading } = useAvisoEmpresas();
  const [mensagem, setMensagem] = useState('');
  const [q, setQ] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

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
    try {
      const { data, error } = await supabase.functions.invoke('avisos-digisac-mensagem', {
        body: { empresa_id: empresaId, mensagem: texto },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.erro) throw new Error(String((data as any).erro));
      setSentIds((prev) => new Set(prev).add(empresaId));
      toast.success(`Enviado para ${empresaName}.`);
    } catch (e) {
      toast.error(`Falha ao enviar para ${empresaName}: ${(e as Error).message}`);
    } finally {
      setSendingId(null);
    }
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
    </div>
  );
};

export default MensageriaPage;