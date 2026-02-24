import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';
import { useCprbLegalParameters, CprbLegalParameter } from '@/hooks/useCprbLegalParameters';
import { toast } from 'sonner';
import { useState } from 'react';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const CprbStep2LegalParams = ({ onNext, onBack }: Props) => {
  const { data: params, isLoading, upsert, remove } = useCprbLegalParameters();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Partial<CprbLegalParameter>>({});

  const handleEdit = (p: CprbLegalParameter) => {
    setEditingId(p.id);
    setEditRow({ ...p });
  };

  const handleSave = async () => {
    try {
      await upsert.mutateAsync(editRow);
      setEditingId(null);
      toast.success('Parâmetro salvo com sucesso');
    } catch {
      toast.error('Erro ao salvar parâmetro');
    }
  };

  const handleAdd = async () => {
    const now = new Date();
    const ano = now.getFullYear();
    try {
      await upsert.mutateAsync({
        ano,
        competencia_inicio: `${ano}-01`,
        competencia_fim: `${ano}-12`,
        setor: 'construcao_civil',
        aliquota_cprb: 0.045,
        percentual_cprb_transicao: 1,
        percentual_folha_transicao: 0,
        aliquota_patronal_folha: 0.20,
      });
      toast.success('Novo parâmetro adicionado');
    } catch {
      toast.error('Erro ao adicionar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success('Parâmetro removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const pct = (v: number) => `${(Number(v) * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">
              Tabela Legal — Reoneração Gradual
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-muted-foreground inline ml-1 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm text-xs">
                  Parâmetros da Lei 14.973/2024 que define a reoneração gradual da folha. Edite os valores conforme a legislação vigente.
                </TooltipContent>
              </Tooltip>
            </h3>
            <Button variant="outline" size="sm" onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ano</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Alíq. CPRB</TableHead>
                    <TableHead>% CPRB (transição)</TableHead>
                    <TableHead>% Folha (transição)</TableHead>
                    <TableHead>% Patronal</TableHead>
                    <TableHead>Fonte Legal</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {params?.map((p) => (
                    <TableRow key={p.id}>
                      {editingId === p.id ? (
                        <>
                          <TableCell>
                            <Input type="number" className="w-20" value={editRow.ano} onChange={(e) => setEditRow({ ...editRow, ano: parseInt(e.target.value) })} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Input type="month" className="w-32" value={editRow.competencia_inicio} onChange={(e) => setEditRow({ ...editRow, competencia_inicio: e.target.value })} />
                              <Input type="month" className="w-32" value={editRow.competencia_fim} onChange={(e) => setEditRow({ ...editRow, competencia_fim: e.target.value })} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input type="number" step={0.1} className="w-20" value={Number(editRow.aliquota_cprb) * 100} onChange={(e) => setEditRow({ ...editRow, aliquota_cprb: parseFloat(e.target.value) / 100 })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step={1} className="w-20" value={Number(editRow.percentual_cprb_transicao) * 100} onChange={(e) => setEditRow({ ...editRow, percentual_cprb_transicao: parseFloat(e.target.value) / 100 })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step={1} className="w-20" value={Number(editRow.percentual_folha_transicao) * 100} onChange={(e) => setEditRow({ ...editRow, percentual_folha_transicao: parseFloat(e.target.value) / 100 })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step={1} className="w-20" value={Number(editRow.aliquota_patronal_folha) * 100} onChange={(e) => setEditRow({ ...editRow, aliquota_patronal_folha: parseFloat(e.target.value) / 100 })} />
                          </TableCell>
                          <TableCell>
                            <Input className="w-40" value={editRow.fonte_legal || ''} onChange={(e) => setEditRow({ ...editRow, fonte_legal: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" onClick={handleSave}>Salvar</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>✕</Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{p.ano}</TableCell>
                          <TableCell className="text-xs">{p.competencia_inicio} a {p.competencia_fim}</TableCell>
                          <TableCell>{pct(p.aliquota_cprb)}</TableCell>
                          <TableCell>{pct(p.percentual_cprb_transicao)}</TableCell>
                          <TableCell>{pct(p.percentual_folha_transicao)}</TableCell>
                          <TableCell>{pct(p.aliquota_patronal_folha)}</TableCell>
                          <TableCell className="text-xs">{p.fonte_legal || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(p)}>Editar</Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {params && params.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {params.length} parâmetro(s) cadastrado(s). Edite os valores conforme a legislação vigente por competência/ano.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>← Voltar</Button>
        <Button onClick={onNext} size="lg">Próximo: Simulação →</Button>
      </div>
    </div>
  );
};

export default CprbStep2LegalParams;
