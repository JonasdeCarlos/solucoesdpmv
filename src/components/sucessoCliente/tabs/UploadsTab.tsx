import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download } from 'lucide-react';
import { useUploads } from '@/hooks/useSucessoCliente';
import { toast } from 'sonner';

export default function UploadsTab({ client_id }: { client_id: string }) {
  const { items, upload, getUrl } = useUploads(client_id);
  const [type, setType] = useState('holerite_modelo');

  const handle = async (f: File) => {
    const { error } = await upload(f, type);
    if (error) toast.error('Erro: ' + (error as any).message);
    else toast.success('Arquivo enviado.');
  };

  const open = async (path: string) => {
    const url = await getUrl(path);
    if (url) window.open(url, '_blank');
  };

  const label = (t: string) => ({ holerite_modelo: 'Holerite modelo', ponto_modelo: 'Modelo de ponto', outro: 'Outro' } as any)[t] || t;

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex gap-2 items-end">
        <div>
          <Label>Tipo</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="holerite_modelo">Holerite modelo</SelectItem>
              <SelectItem value="ponto_modelo">Modelo de ponto</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="inline-flex">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" className="hidden" onChange={(e)=>e.target.files?.[0] && handle(e.target.files[0])}/>
          <span className="inline-flex items-center px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground cursor-pointer hover:opacity-90"><Upload className="w-4 h-4 mr-1"/>Enviar arquivo</span>
        </label>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Arquivo</TableHead><TableHead>Versão</TableHead><TableHead>Data</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {items.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum arquivo.</TableCell></TableRow> :
          items.map(u => (
            <TableRow key={u.id}>
              <TableCell><Badge variant="outline">{label(u.upload_type)}</Badge></TableCell>
              <TableCell className="truncate max-w-xs">{u.file_name}</TableCell>
              <TableCell>v{u.version}</TableCell>
              <TableCell className="text-xs">{new Date(u.uploaded_at).toLocaleString('pt-BR')}</TableCell>
              <TableCell><Button size="sm" variant="ghost" onClick={()=>open(u.file_path)}><Download className="w-4 h-4"/></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}