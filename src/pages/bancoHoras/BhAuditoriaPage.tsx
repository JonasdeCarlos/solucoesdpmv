import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useBhAll } from '@/hooks/useBancoHorasModulo';
import { competenciaLabel } from '@/utils/bancoHoras/calc';
import { supabase } from '@/integrations/supabase/client';

export default function BhAuditoriaPage() {
  const { imports, loading } = useBhAll();

  const downloadPdf = async (path: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from('ponto-pdfs').createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    if (error) console.error(error);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Importações</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-left">Empresa</th>
              <th className="p-2 text-left">Compet.</th>
              <th className="p-2 text-left">Arquivo</th>
              <th className="p-2 text-left">Importado por</th>
              <th className="p-2 text-right">Páginas</th>
              <th className="p-2 text-right">OK</th>
              <th className="p-2 text-right">Pendentes</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {imports.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="p-2">{new Date(i.imported_at).toLocaleString('pt-BR')}</td>
                <td className="p-2">{i.empresa_nome}</td>
                <td className="p-2">{i.competencia ? competenciaLabel(i.competencia) : '—'}</td>
                <td className="p-2 truncate max-w-[200px]">{i.file_name}</td>
                <td className="p-2">{i.imported_by}</td>
                <td className="p-2 text-right">{i.total_paginas}</td>
                <td className="p-2 text-right text-green-700">{i.total_ok}</td>
                <td className="p-2 text-right text-yellow-700">{i.total_pendentes}</td>
                <td className="p-2">
                  {i.file_path && (
                    <Button size="sm" variant="ghost" onClick={() => downloadPdf(i.file_path)}>
                      <Download className="w-3 h-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {imports.length === 0 && (
              <tr><td colSpan={9} className="p-3 text-center text-muted-foreground">Nenhuma importação ainda.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
