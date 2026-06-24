import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Download, Trash2, FileStack } from 'lucide-react';
import PdfSplitter from '@/components/rescisao/PdfSplitter';
import { format } from 'date-fns';
import { useRescisaoDossiers } from '@/hooks/useRescisaoDossiers';
import { supabase } from '@/integrations/supabase/client';
import RescisaoStep1Capa from '@/components/rescisao/RescisaoStep1Capa';
import RescisaoStep2Upload from '@/components/rescisao/RescisaoStep2Upload';
import RescisaoStep3Generate from '@/components/rescisao/RescisaoStep3Generate';
import StepIndicator from '@/components/StepIndicator';
import type { UploadedFile } from '@/types/rescisaoDossier';
import type { RescisaoTipoId } from '@/utils/rescisaoTipos';

type WizardStep = 0 | 1 | 2;

const STEPS = ['Dados da Capa', 'Upload Documentos', 'Gerar PDF Final'];
const STORAGE_KEY = 'rescisao_pdf_wizard_state_v1';

interface CapaState {
  employeeName: string;
  terminationDate: string;
  paymentDateSuggested: string;
  paymentDateFinal: string;
  companyName: string;
  companyCnpj: string;
  competenceMonth: string;
  checkedBy: string;
  rescisaoTipo: RescisaoTipoId;
}

const emptyCapaData = (): CapaState => ({
  employeeName: '',
  terminationDate: '',
  paymentDateSuggested: '',
  paymentDateFinal: '',
  companyName: '',
  companyCnpj: '',
  competenceMonth: '',
  checkedBy: '',
  rescisaoTipo: 'sem_justa_causa',
});

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as {
      wizardOpen?: boolean;
      step?: WizardStep;
      capaData?: CapaState;
      uploadedFilesMeta?: Array<Pick<UploadedFile, 'id' | 'name' | 'category' | 'sortOrder'>>;
    } : null;
  } catch {
    return null;
  }
}

const RescisaoPdfPage: React.FC = () => {
  const { dossiers, loading, createDossier, deleteDossier } = useRescisaoDossiers();
  const persisted = loadPersistedState();
  const [wizardOpen, setWizardOpen] = useState(persisted?.wizardOpen ?? false);
  const [step, setStep] = useState<WizardStep>(persisted?.step === 2 ? 1 : persisted?.step ?? 0);
  const [capaData, setCapaData] = useState(persisted?.capaData ?? emptyCapaData());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      wizardOpen,
      step,
      capaData,
      uploadedFilesMeta: uploadedFiles.map(({ id, name, category, sortOrder }) => ({ id, name, category, sortOrder })),
    }));
  }, [wizardOpen, step, capaData, uploadedFiles]);

  const openWizard = () => {
    setCapaData(emptyCapaData());
    setUploadedFiles([]);
    setStep(0);
    setWizardOpen(true);
  };

  const handleFinish = async (pdfBlob: Blob, fileName: string) => {
    // Upload final PDF to storage
    const path = `dossiers/${Date.now()}_${fileName}`;
    const { error: upErr } = await supabase.storage.from('rescisao-docs').upload(path, pdfBlob, {
      contentType: 'application/pdf',
    });

    if (upErr) {
      console.error('Falha ao salvar PDF no storage:', upErr);
      alert('Não foi possível salvar o PDF para o histórico: ' + upErr.message);
    }
    const pdfUrl = upErr ? null : path;

    await createDossier({
      employee_name: capaData.employeeName,
      termination_date: capaData.terminationDate,
      payment_date_suggested: capaData.paymentDateSuggested || null,
      payment_date_final: capaData.paymentDateFinal || null,
      competence_month: capaData.competenceMonth || null,
      company_name: capaData.companyName || null,
      company_cnpj: capaData.companyCnpj || null,
      checked_by: capaData.checkedBy || null,
      final_pdf_url: pdfUrl,
      status: 'concluido',
    });

    setWizardOpen(false);
  };

  const handleDownload = async (d: any) => {
    if (!d.final_pdf_url) return;
    const { data } = await supabase.storage.from('rescisao-docs').download(d.final_pdf_url);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RESCISÃO - ${d.employee_name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (wizardOpen) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Nova Montagem de Rescisão</h2>
          <Button variant="outline" size="sm" onClick={() => setWizardOpen(false)}>Cancelar</Button>
        </div>
        <StepIndicator currentStep={step + 1} totalSteps={3} labels={STEPS} />
        <Card>
          <CardContent className="pt-6">
            {step === 0 && (
              <RescisaoStep1Capa data={capaData} onChange={setCapaData} onNext={() => setStep(1)} />
            )}
            {step === 1 && (
              <RescisaoStep2Upload files={uploadedFiles} onChange={setUploadedFiles} onNext={() => setStep(2)} onBack={() => setStep(0)} />
            )}
            {step === 2 && (
              <RescisaoStep3Generate capaData={capaData} files={uploadedFiles} onBack={() => setStep(1)} onFinish={handleFinish} />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileStack className="h-6 w-6" /> Montador de PDF — Rescisão
          </h2>
          <p className="text-sm text-muted-foreground">Junção de documentos + Capa automática</p>
        </div>
        <Button onClick={openWizard}>
          <Plus className="h-4 w-4 mr-1" /> Nova Rescisão
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Montagens</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : dossiers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma montagem realizada. Clique em "Nova Rescisão" para começar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empregado</TableHead>
                  <TableHead>Data Rescisão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dossiers.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.employee_name}</TableCell>
                    <TableCell>{d.termination_date && format(new Date(d.termination_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === 'concluido' ? 'default' : 'secondary'}>
                        {d.status === 'concluido' ? 'Concluído' : 'Rascunho'}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(d.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {d.final_pdf_url && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(d)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteDossier(d.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <PdfSplitter />
    </div>
  );
};

export default RescisaoPdfPage;
