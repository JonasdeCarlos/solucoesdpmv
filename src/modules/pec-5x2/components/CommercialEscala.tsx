import { useEffect, useRef, useState } from 'react';
import EscalaEditor from '@/modules/escala-revezamento/components/EscalaEditor';
import { paramsDe, type EscalaFuncionario, type EscalaParams } from '@/modules/escala-revezamento/motor';
import { gerarPdf, gerarXlsx } from '@/modules/escala-revezamento/exportar';
import { Button } from '@/components/ui/button';
import { FileDown, FileSpreadsheet, Save } from 'lucide-react';
import { commercialCall } from '../commercialApi';
import { toast } from 'sonner';

export default function CommercialEscala({ token, empresa }: { token: string; empresa: { nome: string } }) {
  const [params, setParams] = useState<EscalaParams | null>(null);
  const [funcionarios, setFuncionarios] = useState<EscalaFuncionario[]>([]);
  const [status, setStatus] = useState('');
  const ready = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const save = (p: EscalaParams, fs: EscalaFuncionario[]) => {
    setStatus('Salvando…');
    const result = queue.current.catch(() => undefined).then(() => commercialCall('escala_save', token, { dados: { params: p, funcionarios: fs } }));
    queue.current = result;
    result.then(() => { localStorage.removeItem(`pec-commercial-draft-${token}`); setStatus('Rascunho salvo'); }).catch((e) => { setStatus('Alterações não salvas'); toast.error(e.message); });
  };
  useEffect(() => {
    commercialCall('load', token).then(d => {
      const now = new Date();
      const inicio = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
      const fim = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().slice(0, 10);
      let saved = d.escala;
      try { saved = JSON.parse(localStorage.getItem(`pec-commercial-draft-${token}`) || 'null') || saved; } catch { /* recovery */ }
      setParams(saved?.params || paramsDe({ regime: '5x2', data_inicio: inicio, data_fim: fim, categoria_atividade: 'DEMAIS_NAO_AUTORIZADAS', atividade_anexo_iv: '', fundamento_trabalho_domingo: '', cct_vigente: false, cct_registro: '', regras_cct: {}, prazo_folga_compensatoria_feriado: 7, n_domingos: 3, minimo_diario: 0, setor: '', responsavel_nome: '' }));
      setFuncionarios(saved?.funcionarios || []);
      ready.current = true;
    }).catch(e => toast.error(e.message));
  }, [token]);
  useEffect(() => {
    if (!ready.current || !params) return;
    localStorage.setItem(`pec-commercial-draft-${token}`, JSON.stringify({ params, funcionarios }));
    setStatus('Alterações pendentes');
    const timer = setTimeout(() => save(params, funcionarios), 1200);
    return () => clearTimeout(timer);
  }, [params, funcionarios]);
  if (!params) return <p>Carregando escala…</p>;
  const info = { cliente: empresa, params, funcionarios };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => save(params, funcionarios)}><Save className="h-4 w-4 mr-2" />Salvar</Button>
      <span className="text-sm text-muted-foreground" role="status">{status}</span>
      <Button variant="outline" onClick={() => gerarPdf(info)}><FileDown className="h-4 w-4 mr-2" />PDF da escala</Button>
      <Button variant="outline" onClick={() => gerarXlsx(info)}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
    </div>
    <EscalaEditor params={params} onParams={setParams} funcionarios={funcionarios} onFuncionarios={setFuncionarios} cliente={empresa} comercial />
  </div>;
}