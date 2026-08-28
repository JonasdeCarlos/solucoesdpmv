import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const b = await req.json();
    const numeroSolicitacao = String(b.numero_solicitacao || '').trim();
    if (!numeroSolicitacao) return json({ error: 'Informe o número da solicitação (MR) do instrumento.' }, 400);

    const titulo = String(b.titulo || `Instrumento ${numeroSolicitacao}`).slice(0, 200);
    const tipo = String(b.tipo || '');
    const numeroRegistro = String(b.numero_registro || '');
    const vigencia = String(b.vigencia || '');
    const partes: string[] = Array.isArray(b.partes) ? b.partes.map(String) : [];
    const urlVisualizar =
      String(b.url || '') ||
      `https://mediador.trabalho.gov.br/sistemas/mediador/Resumo/ResumoVisualizar?NrSolicitacao=${encodeURIComponent(numeroSolicitacao)}`;
    const urlDownload =
      String(b.url_download || '') ||
      `https://mediador.trabalho.gov.br/sistemas/mediador/Resumo/resumoVisualizarSalvarMsWordDoc?NrSolicitacao=${encodeURIComponent(numeroSolicitacao)}`;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Usuário chamador (opcional) para registrar autoria.
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = data?.user?.id ?? null;
    }

    // Baixa o documento oficial do Mediador.
    let bytes: Uint8Array | null = null;
    let fileName = `${(numeroRegistro || numeroSolicitacao).replace(/[^A-Za-z0-9]/g, '_')}.doc`;
    let mime = 'application/msword';
    try {
      const r = await fetch(urlDownload, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9', Referer: urlVisualizar },
        signal: AbortSignal.timeout(60000),
      });
      if (r.ok) {
        const ct = r.headers.get('content-type') || '';
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.byteLength > 2000 && !/text\/html/i.test(ct)) {
          bytes = buf;
          if (/pdf/i.test(ct)) {
            mime = 'application/pdf';
            fileName = fileName.replace(/\.doc$/, '.pdf');
          }
        }
      }
    } catch (e) {
      console.log('download mediador falhou', String(e));
    }

    const { data: created, error: insErr } = await admin
      .from('cct_analyses')
      .insert({
        title: titulo,
        status: 'em_analise',
        created_by: userId,
        reviewer_notes: [
          'Importado do Sistema Mediador (MTE).',
          tipo && `Tipo: ${tipo}`,
          numeroRegistro && `Registro: ${numeroRegistro}`,
          `Solicitação: ${numeroSolicitacao}`,
          vigencia && `Vigência: ${vigencia}`,
          partes.length ? `Partes: ${partes.join(' × ')}` : '',
          `Fonte: ${urlVisualizar}`,
        ].filter(Boolean).join('\n'),
      })
      .select('id')
      .single();
    if (insErr) throw insErr;
    const id = created.id as string;

    let filePath: string | null = null;
    if (bytes) {
      const key = `${id}/${crypto.randomUUID()}-${fileName}`;
      const { error: upErr } = await admin.storage.from('cct-docs').upload(key, bytes, { contentType: mime, upsert: false });
      if (upErr) {
        console.log('upload falhou', upErr.message);
      } else {
        filePath = key;
        await admin.from('cct_analysis_files').insert({
          cct_analysis_id: id,
          file_path: key,
          file_name: fileName,
          file_kind: 'principal',
          mime_type: mime,
          size_bytes: bytes.byteLength,
          order_index: 0,
          uploaded_by: userId,
        });
        await admin.from('cct_analyses').update({ original_file_path: key, original_file_name: fileName }).eq('id', id);
      }
    }

    return json({
      id,
      arquivo_importado: !!filePath,
      observacao: filePath
        ? 'Instrumento importado com o documento oficial. Agora é possível analisar com IA na Gestão de CCT.'
        : 'CCT criada, mas o documento não pôde ser baixado automaticamente do Mediador — anexe o arquivo manualmente.',
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
