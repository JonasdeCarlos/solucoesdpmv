import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import SelecionarEmpresaDialog from '@/components/sucessoCliente/SelecionarEmpresaDialog';
import type { ModeloDoc } from './useModelosDocumento';
import { TIPO_LABEL } from './lib';

export default function ReplicarModeloDialog({ modelo, onClose }: { modelo: ModeloDoc; onClose: () => void }) {
  const [empresa, setEmpresa] = useState<string | null>(null);
  const [politicas, setPoliticas] = useState<{ id: string; nome: string }[] | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const escolheu = useRef(false);

  useEffect(() => {
    if (!empresa) return;
    const q = modelo.escopo === 'excelencia'
      ? (supabase.from('premiacao_politicas' as any) as any).select('id,nome').eq('empresa_id', empresa)
      : (supabase.from('prize_policies' as any) as any).select('id,nome').eq('client_id', empresa);
    q.order('nome').then(({ data }: any) => { setPoliticas(data || []); setMarcadas((data || []).map((p: any) => p.id)); });
  }, [empresa, modelo.escopo]);

  const copiar = async () => {
    if (!empresa || !marcadas.length) return;
    setBusy(true);
    try {
      const t = supabase.from('premio_modelos_documento' as any) as any;
      for (const refId of marcadas) {
        const row = { empresa_id: empresa, escopo: modelo.escopo, ref_id: refId, tipo: modelo.tipo, nome: modelo.nome, arquivo_nome: modelo.arquivo_nome, pdf_base64: modelo.pdf_base64, campos: modelo.campos, usar_personalizado: modelo.usar_personalizado };
        const { data: ex } = await t.select('id').eq('ref_id', refId).eq('tipo', modelo.tipo).limit(1);
        const { error } = ex?.[0] ? await t.update(row).eq('id', ex[0].id) : await t.insert(row);
        if (error) throw error;
      }
      toast.success(`Modelo replicado para ${marcadas.length} política(s).`);
      onClose();
    } catch (e: any) { toast.error(e?.message || 'Falha ao replicar.'); } finally { setBusy(false); }
  };

  if (!empresa) return (
    <SelecionarEmpresaDialog open onOpenChange={o => { if (!o && !escolheu.current) onClose(); escolheu.current = false; }} title={`Replicar ${TIPO_LABEL[modelo.tipo].toLowerCase()}`}
      description="Escolha a empresa que vai receber este modelo." confirmLabel="Avançar" excludeIds={[modelo.empresa_id]}
      onConfirm={id => { escolheu.current = true; setEmpresa(id); }} />
  );

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Em quais políticas usar o modelo?</DialogTitle>
          <DialogDescription>Se a política já tiver um modelo deste tipo, ele será substituído.</DialogDescription>
        </DialogHeader>
        {!politicas ? <Loader2 className="w-4 h-4 animate-spin" /> : politicas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta empresa ainda não tem política {modelo.escopo === 'excelencia' ? 'do Programa Excelência' : 'de prêmio'}. Crie uma antes de replicar.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-auto">
            {politicas.map(p => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={marcadas.includes(p.id)} onCheckedChange={v => setMarcadas(s => v ? [...s, p.id] : s.filter(x => x !== p.id))} />{p.nome}
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setEmpresa(null)}>Trocar empresa</Button>
          <Button onClick={copiar} disabled={busy || !marcadas.length}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Replicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
