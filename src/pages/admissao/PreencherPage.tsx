import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send } from 'lucide-react';
import {
  AdmissionRequest, getRequestByToken, saveDraftAnswers, submitAnswers,
} from '@/hooks/useAdmissaoRequests';
import { useAdmissaoFiles } from '@/hooks/useAdmissaoFiles';
import FieldRenderer from '@/components/admissao/preencher/FieldRenderer';
import FileUploadField from '@/components/admissao/preencher/FileUploadField';
import WorkScheduleField from '@/components/admissao/preencher/WorkScheduleField';
import { isValidCpf, isValidEmail, isValidCep } from '@/utils/admissao/validators';
import { isFieldEmpty } from '@/utils/admissao/formSchema';
import { toast } from 'sonner';

const PreencherPage = () => {
  const { token = '' } = useParams();
  const [req, setReq] = useState<AdmissionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [sectionIdx, setSectionIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const { files, uploadFile, deleteFile } = useAdmissaoFiles(req?.id || null);

  useEffect(() => {
    getRequestByToken(token).then((r) => {
      setReq(r);
      if (r) {
        setAnswers(r.draft_answers || {});
        if (r.status !== 'rascunho') setDone(true);
      }
      setLoading(false);
    });
  }, [token]);

  // Auto-save draft
  useEffect(() => {
    if (!req || done) return;
    const t = setTimeout(() => {
      saveDraftAnswers(req.id, answers);
    }, 1500);
    return () => clearTimeout(t);
  }, [answers, req, done]);

  // Sync file fields into answers
  useEffect(() => {
    if (!req) return;
    setAnswers((prev) => {
      const next = { ...prev };
      for (const sec of req.template_schema_snapshot.sections) {
        for (const f of sec.fields) {
          if (f.type === 'file') {
            next[f.field_key] = files.filter((x) => x.field_key === f.field_key).map((x) => x.original_name);
          }
        }
      }
      return next;
    });
  }, [files, req]);

  const sections = req?.template_schema_snapshot.sections || [];
  const currentSection = sections[sectionIdx];

  const validateField = (field: any, value: any): string | null => {
    const empty = isFieldEmpty(field, value);
    if (field.required && empty) return 'Campo obrigatório';
    if (empty) return null;
    if (field.type === 'cpf' && typeof value === 'string' && !isValidCpf(value)) return 'CPF inválido';
    if (field.type === 'email' && typeof value === 'string' && !isValidEmail(value)) return 'E-mail inválido';
    if (field.type === 'cep' && typeof value === 'string' && !isValidCep(value)) return 'CEP inválido';
    return null;
  };

  const sectionErrors = useMemo(() => {
    if (!currentSection) return {};
    const errs: Record<string, string> = {};
    for (const f of currentSection.fields) {
      if (f.type === 'file') {
        const arr = files.filter((x) => x.field_key === f.field_key);
        if (f.required && arr.length === 0) errs[f.field_key] = 'Envie ao menos um arquivo';
        continue;
      }
      const e = validateField(f, answers[f.field_key]);
      if (e) errs[f.field_key] = e;
    }
    return errs;
  }, [currentSection, answers, files]);

  const allErrors = useMemo(() => {
    if (!req) return {};
    const errs: Record<string, string> = {};
    for (const sec of sections) {
      for (const f of sec.fields) {
        if (f.type === 'file') {
          const arr = files.filter((x) => x.field_key === f.field_key);
          if (f.required && arr.length === 0) errs[f.field_key] = 'Envie ao menos um arquivo';
          continue;
        }
        const e = validateField(f, answers[f.field_key]);
        if (e) errs[f.field_key] = e;
      }
    }
    return errs;
  }, [req, sections, answers, files]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!req) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <h1 className="text-xl font-bold">Link inválido</h1>
          <p className="text-sm text-muted-foreground mt-2">Este link de admissão não existe ou foi removido.</p>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="p-8 max-w-lg text-center">
          <h1 className="text-2xl font-bold text-primary">Formulário enviado!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Recebemos suas informações e documentos. O escritório dará andamento à sua admissão.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const goNext = () => {
    if (Object.keys(sectionErrors).length > 0) {
      toast.error('Preencha os campos obrigatórios desta seção');
      return;
    }
    if (sectionIdx < sections.length - 1) setSectionIdx(sectionIdx + 1);
  };

  const submit = async () => {
    if (Object.keys(allErrors).length > 0) {
      toast.error('Há campos obrigatórios pendentes');
      // Jump to first section with error
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].fields.some((f) => allErrors[f.field_key])) { setSectionIdx(i); break; }
      }
      return;
    }
    setSubmitting(true);
    const { error } = await submitAnswers(req.id, answers);
    setSubmitting(false);
    if (error) return toast.error('Erro ao enviar');
    setDone(true);
  };

  const progress = ((sectionIdx + 1) / sections.length) * 100;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{req.template_name_snapshot}</h1>
          <p className="text-sm text-muted-foreground">
            {req.company_name}{req.company_cnpj && ` · ${req.company_cnpj}`}
          </p>
        </div>
        <Progress value={progress} />
        <p className="text-xs text-muted-foreground">Seção {sectionIdx + 1} de {sections.length}</p>

        {currentSection && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">{currentSection.title}</h2>
              {currentSection.description && (
                <p className="text-sm text-muted-foreground">{currentSection.description}</p>
              )}
            </div>
            {currentSection.fields.map((f) => {
              if (f.type === 'file') {
                const fieldFiles = files.filter((x) => x.field_key === f.field_key);
                return (
                  <FileUploadField
                    key={f.id}
                    field={f}
                    files={fieldFiles}
                    error={sectionErrors[f.field_key]}
                    onUpload={async (file) => {
                      const order = fieldFiles.length;
                      const { error } = await uploadFile(req.id, f.field_key, file, order);
                      if (error) toast.error('Erro ao enviar arquivo');
                    }}
                    onDelete={async (id, path) => {
                      const { error } = await deleteFile(id, path);
                      if (error) toast.error('Erro ao remover');
                    }}
                  />
                );
              }
              if (f.type === 'work_schedule') {
                return (
                  <WorkScheduleField
                    key={f.id}
                    field={f}
                    value={answers[f.field_key]}
                    onChange={(v) => setAnswers({ ...answers, [f.field_key]: v })}
                    error={sectionErrors[f.field_key]}
                  />
                );
              }
              return (
                <FieldRenderer
                  key={f.id}
                  field={f}
                  value={answers[f.field_key]}
                  onChange={(v) => setAnswers({ ...answers, [f.field_key]: v })}
                  error={sectionErrors[f.field_key]}
                />
              );
            })}
          </Card>
        )}

        <div className="flex justify-between">
          <Button variant="outline" disabled={sectionIdx === 0} onClick={() => setSectionIdx(sectionIdx - 1)}>
            Voltar
          </Button>
          {sectionIdx < sections.length - 1 ? (
            <Button onClick={goNext}>Avançar</Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Enviar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreencherPage;