import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const BASE_URL = Deno.env.get('DIGISAC_BASE_URL') || 'https://contabilmv.digisac.co';
  const TOKEN = Deno.env.get('DIGISAC_API_TOKEN') || Deno.env.get('DIGISAC_TOKEN');
  const DEPARTMENT_ID = Deno.env.get('DIGISAC_DEPARTMENT_ID_PESSOAL');

  if (!TOKEN || !DEPARTMENT_ID) {
    return new Response(
      JSON.stringify({ erro: 'DIGISAC_API_TOKEN/DIGISAC_DEPARTMENT_ID_PESSOAL ausentes.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(
      `${BASE_URL}/api/v1/users?departmentId=${DEPARTMENT_ID}`,
      { method: 'GET', headers: { 'Authorization': `Bearer ${TOKEN}` }, signal: controller.signal },
    );
    const text = await r.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!r.ok) {
      return new Response(
        JSON.stringify({ erro: `Digisac retornou ${r.status}`, detalhe: data }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let usuarios: any[] = [];
    if (Array.isArray(data)) usuarios = data;
    else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      usuarios = (obj.data as any[]) || (obj.rows as any[]) || (obj.users as any[]) || [];
    }

    // Filtra apenas usuários do Departamento Pessoal (caso a API retorne todos).
    const filtrados = usuarios.filter((u: any) => {
      if (!u) return false;
      const deps = u.departments || u.departmentIds || [];
      if (!Array.isArray(deps) || deps.length === 0) return true; // mantém se não há info
      return deps.some((d: any) => (typeof d === 'string' ? d : d?.id) === DEPARTMENT_ID);
    });

    const simplificado = filtrados.map((u: any) => ({
      id: u.id,
      nome: u.name || u.fullName || u.firstName || 'Sem nome',
      email: u.email || null,
    })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

    return new Response(
      JSON.stringify({ usuarios: simplificado, total: simplificado.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return new Response(
      JSON.stringify({ erro: aborted ? 'timeout_15s' : (err instanceof Error ? err.message : 'erro desconhecido') }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } finally {
    clearTimeout(timeoutId);
  }
});