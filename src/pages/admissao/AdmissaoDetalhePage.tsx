import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Copy as CopyIcon, FileDown, RefreshCw, Loader2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AdmissionRequest, getRequestById, STATUS_LABELS, useAdmissaoRequests, AdmissionStatus,
} from '@/hooks/useAdmissaoRequests';
import { listFilesForRequest } from '@/hooks/useAdmissaoFiles';
import type { AdmissionFileRow } from '@/utils/admissao/dossieBuilder';
import { buildDossie, extractEmployeeIdentity } from '@/utils/admissao/dossieBuilder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';

const STATUSES: AdmissionStatus[] = ['rascunho','enviado','em_analise','pendente','aprovado','concluido','cancelado'];

const AdmissaoDetalhePage = () => {
  const { id = '' } = useParams();
  const { updateStatus } = useAdmissaoRequests();
  const [req, setReq] = useState<AdmissionRequest | null>(null);
  const [files, setFiles] = useState<AdmissionFileRow[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const r = await getRequestById(id);
    setReq(r);
    if (r) {
      const fs = await listFilesForRequest(r.id);
      setFiles(fs);
    }
  };

  useEffect(() => { reload(); }, [id]);

  if (!req) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const copyLink = async () => {
    const url = `${window.location.origin}/admissao/preencher/${req.token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado');
  };

  const generateDossie = async () => {
    setBusy(true);
    try {
      const answers = req.status === 'rascunho' ? req.draft_answers : req.answers;
      const id = extractEmployeeIdentity(req.template_schema_snapshot, answers);
      const submittedAt = req.submitted_at
        ? new Date(req.submitted_at).toLocaleDateString('pt-BR')
        : new Date().toLocaleDateString('pt-BR');
      const { pdfBytes, fileName } = await buildDossie({
        schema: req.template_schema_snapshot,
        answers,
        files,
        meta: {
          companyName: req.company_name,
          companyCnpj: req.company_cnpj,
          employeeName: id.name || req.employee_name,
          employeeCpf: id.cpf,
          submittedAt,
          templateName: req.template_name_snapshot,
          status: STATUS_LABELS[req.status],
        },
      });
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      saveAs(blob, fileName);

      // Save to storage + table
      const path = `${req.id}/dossie-${Date.now()}.pdf`;
      await supabase.storage.from('admissao-dossies').upload(path, blob, {
        contentType: 'application/pdf', upsert: false,
      });
      await supabase.from('admission_dossiers' as any).insert({
        request_id: req.id, pdf_path: path, file_name: fileName,
      } as any);

      toast.success('Dossiê gerado');
    } catch (e) {
      console.error(e);
      toast.error('Falha ao gerar dossiê');
    } finally {
      setBusy(false);
    }
  };

  const answers = req.status === 'rascunho' ? req.draft_answers : req.answers;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admissao/escritorio"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={copyLink}>
          <CopyIcon className="w-4 h-4 mr-1" /> Copiar link
        </Button>
        <Button variant="outline" size="sm" onClick={reload}>
          <RefreshCw className="w-4 h-4 mr-1" /> Recarregar
        </Button>
        <Button onClick={generateDossie} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
          Gerar Dossiê PDF
        </Button>
      </div>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold flex-1">
            {req.employee_name || extractEmployeeIdentity(req.template_schema_snapshot, answers).name || '(sem nome)'}
          </h2>
          <Badge>{STATUS_LABELS[req.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {req.company_name} {req.company_cnpj && <>· {req.company_cnpj}</>} · {req.template_name_snapshot}
        </p>
        <div className="flex items-center gap-2 pt-2">
          <span className="text-sm">Status:</span>
          <Select
            value={req.status}
            onValueChange={async (v) => {
              await updateStatus(req.id, v as AdmissionStatus);
              await reload();
              toast.success('Status atualizado');
            }}
          >
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Respostas</h3>
        {req.template_schema_snapshot.sections.map((sec) => (
          <div key={sec.id} className="mb-4">
            <h4 className="font-medium text-sm border-b pb-1 mb-2">{sec.title}</h4>
            <dl className="space-y-2">
              {sec.fields.map((f) => {
                const v = answers[f.field_key];
                if (f.type === 'file') {
                  const arr = Array.isArray(v) ? v : [];
                  return (
                    <div key={f.id} className="grid grid-cols-3 gap-2 text-sm">
                      <dt className="text-muted-foreground">{f.label}</dt>
                      <dd className="col-span-2">{arr.length > 0 ? `${arr.length} arquivo(s)` : <span className="text-muted-foreground italic">não enviado</span>}</dd>
                    </div>
                  );
                }
                const display = Array.isArray(v) ? v.join(', ') : (v ?? '');
                return (
                  <div key={f.id} className="grid grid-cols-3 gap-2 text-sm">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="col-span-2">{display || <span className="text-muted-foreground italic">não informado</span>}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Anexos ({files.length})</h3>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum arquivo enviado.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between border-b pb-1">
                <span className="truncate">{f.original_name}</span>
                <span className="text-xs text-muted-foreground">{f.field_key}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default AdmissaoDetalhePage;