import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileText } from 'lucide-react';
import { useClientes } from '@/hooks/useClientes';
import { type PontoConfig } from '@/types/ponto';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Props {
  config: PontoConfig;
}

const PontoBlankSheet: React.FC<Props> = ({ config }) => {
  const { clientes, loading } = useClientes();
  const [open, setOpen] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [empregadoNome, setEmpregadoNome] = useState('');
  const [empregadoCpf, setEmpregadoCpf] = useState('');
  const [empregadoFuncao, setEmpregadoFuncao] = useState('');
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [modo, setModo] = useState<'mes' | 'ano'>('mes');
  const [mesSelecionado, setMesSelecionado] = useState(String(new Date().getMonth() + 1));

  const clienteSelecionado = clientes.find(c => c.id === clienteId);

  const gerarHtmlMes = (mesNum: number, anoNum: number) => {
    const totalDias = new Date(anoNum, mesNum, 0).getDate();
    const mesNome = MESES[mesNum - 1];
    const cols = config.colunasMarcacoes;
    const labels = cols === 6
      ? ['Entrada', 'S.Int.1', 'E.Int.1', 'S.Int.2', 'E.Int.2', 'Saída']
      : ['Entrada', 'Saída Int.', 'Ent. Int.', 'Saída'];

    const empresa = clienteSelecionado;

    let rows = '';
    for (let d = 1; d <= totalDias; d++) {
      const date = new Date(anoNum, mesNum - 1, d);
      const dow = date.getDay();
      const ds = DIAS_SEMANA[dow];
      const isFolga = dow === 0 || dow === 6;
      const bgStyle = isFolga ? 'background:#f5f5f5;' : '';
      const emptyCells = Array(cols).fill('<td style="border:1px solid #999;padding:4px 3px;min-width:50px;">&nbsp;</td>').join('');
      rows += `<tr style="${bgStyle}">
        <td style="border:1px solid #999;padding:2px 4px;text-align:center;font-weight:bold;">${String(d).padStart(2, '0')}</td>
        <td style="border:1px solid #999;padding:2px 4px;text-align:center;">${ds}</td>
        ${emptyCells}
        <td style="border:1px solid #999;padding:2px 4px;min-width:60px;">&nbsp;</td>
      </tr>`;
    }

    const headerLabels = labels.map(l => `<th style="border:1px solid #999;padding:3px 4px;background:#eee;font-size:7.5pt;text-align:center;">${l}</th>`).join('');

    // Jornada semanal table
    const jornadaHead = Object.keys(config.jornadaSemanal).map(d =>
      `<td style="border:1px solid #ccc;padding:1px 4px;font-weight:bold;background:#eee;text-align:center;font-size:7pt;">${d}</td>`
    ).join('');
    const jornadaVals = Object.values(config.jornadaSemanal).map(hr =>
      `<td style="border:1px solid #ccc;padding:1px 4px;text-align:center;font-family:monospace;font-size:7pt;">${hr || '00:00'}</td>`
    ).join('');

    return `
      <div style="page-break-after: always; padding: 15mm; font-family: Arial, sans-serif; font-size: 9pt; color: #222;">
        <div style="border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 10px;">
          <h2 style="font-size: 13pt; margin: 0 0 4px 0;">FOLHA DE PONTO</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:8.5pt;margin-top:6px;">
            <div>
              <b>Empresa:</b> ${empresa?.nome || ''}<br/>
              <b>${empresa?.tipo === 'PJ' ? 'CNPJ' : 'CPF'}:</b> ${empresa?.tipo === 'PJ' ? empresa?.cnpj || '' : empresa?.cpf || ''}<br/>
              ${empresa?.endereco ? `<b>Endereço:</b> ${empresa.endereco}<br/>` : ''}
            </div>
            <div>
              <b>Empregado:</b> ${empregadoNome}<br/>
              <b>CPF:</b> ${empregadoCpf}<br/>
              ${empregadoFuncao ? `<b>Função:</b> ${empregadoFuncao}<br/>` : ''}
              <b>Período:</b> ${mesNome}/${anoNum}<br/>
              <b>Jornada Semanal:</b><br/>
              <table style="font-size:7pt;border-collapse:collapse;margin-top:2px;">
                <tr>${jornadaHead}</tr>
                <tr>${jornadaVals}</tr>
              </table>
            </div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:8pt;">
          <thead>
            <tr>
              <th style="border:1px solid #999;padding:3px 4px;background:#eee;font-size:7.5pt;">Dia</th>
              <th style="border:1px solid #999;padding:3px 4px;background:#eee;font-size:7.5pt;">DS</th>
              ${headerLabels}
              <th style="border:1px solid #999;padding:3px 4px;background:#eee;font-size:7.5pt;">Obs</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="margin-top:40px;display:flex;justify-content:space-between;">
          <div style="text-align:center;width:45%;"><hr style="border:none;border-top:1px solid #333;margin-bottom:4px;"/> Empregado</div>
          <div style="text-align:center;width:45%;"><hr style="border:none;border-top:1px solid #333;margin-bottom:4px;"/> Empresa / Responsável</div>
        </div>
      </div>
    `;
  };

  const handleEmitir = () => {
    const anoNum = parseInt(ano);
    let content = '';

    if (modo === 'ano') {
      for (let m = 1; m <= 12; m++) {
        content += gerarHtmlMes(m, anoNum);
      }
    } else {
      content += gerarHtmlMes(parseInt(mesSelecionado), anoNum);
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Folha de Ponto em Branco - ${empregadoNome || 'Empregado'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @media print {
            body { padding: 0; }
            div { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="w-4 h-4" />
          Ponto em Branco
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Emitir Folha de Ponto em Branco</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Cliente / Empresa */}
          <div>
            <Label className="text-xs">Empresa (Cliente cadastrado)</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione um cliente'} />
              </SelectTrigger>
              <SelectContent>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} ({c.tipo === 'PJ' ? c.cnpj : c.cpf})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Empregado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome do Empregado</Label>
              <Input value={empregadoNome} onChange={e => setEmpregadoNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label className="text-xs">CPF do Empregado</Label>
              <Input value={empregadoCpf} onChange={e => setEmpregadoCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Função (opcional)</Label>
            <Input value={empregadoFuncao} onChange={e => setEmpregadoFuncao(e.target.value)} placeholder="Cargo / Função" />
          </div>

          {/* Período */}
          <div>
            <Label className="text-xs font-medium">Período</Label>
            <RadioGroup value={modo} onValueChange={v => setModo(v as 'mes' | 'ano')} className="flex gap-4 mt-1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mes" id="modo-mes" />
                <Label htmlFor="modo-mes">Mês específico</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ano" id="modo-ano" />
                <Label htmlFor="modo-ano">Ano inteiro</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {modo === 'mes' && (
              <div>
                <Label className="text-xs">Mês</Label>
                <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Ano</Label>
              <Input type="number" value={ano} onChange={e => setAno(e.target.value)} min="2020" max="2030" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleEmitir}>
              <FileText className="w-4 h-4 mr-2" />
              Emitir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PontoBlankSheet;
