import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { getTemplateById } from '@/hooks/useAdmissaoTemplates';
import { getRequestByToken } from '@/hooks/useAdmissaoRequests';

const PublicoNovaPage = () => {
  const { templateId = '' } = useParams();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const tpl = await getTemplateById(templateId);
      if (!tpl) return setError('Formulário não encontrado.');
      if (!tpl.is_published) return setError('Este formulário ainda não está publicado.');

      // Reuse existing draft on this device (avoid duplicates on reload)
      const lsKey = `admissao_pub_token_${templateId}`;
      const existingToken = localStorage.getItem(lsKey);
      if (existingToken) {
        const existing = await getRequestByToken(existingToken);
        if (existing && existing.status === 'rascunho') {
          nav(`/admissao/preencher/${existingToken}`, { replace: true });
          return;
        }
      }

      const { data: token, error } = await supabase.rpc('create_public_admission', { _template_id: tpl.id });
      if (error || !token) return setError('Erro ao iniciar formulário.');
      localStorage.setItem(lsKey, token);
      nav(`/admissao/preencher/${token}`, { replace: true });
    })();
  }, [templateId, nav]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center">
          <h1 className="text-xl font-bold">Indisponível</h1>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </Card>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
};

export default PublicoNovaPage;