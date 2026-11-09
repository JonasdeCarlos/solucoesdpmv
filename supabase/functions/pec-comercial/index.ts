import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { commercialLeadSchema } from '../../../src/modules/pec-5x2/commercialSchema.ts';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const fields = ['nome', 'ordem', 'funcionarios_atuais', 'funcionarios_por_sexo', 'parciais', 'funcionamento', 'postos', 'intensidade_dias', 'regime_compensacao', 'limite_diario', 'insalubre'];
const pick = (data: Record<string, unknown>) => Object.fromEntries(Object.entries(data || {}).filter(([k]) => fields.includes(k)));

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 500000) return json({ error: 'Dados excedem o limite.' }, 413);
    const b = JSON.parse(raw);
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ error: 'Cadastro temporariamente indisponível.' }, 503);
    const db = createClient(url, key);
    if (b.action === 'register') {
      const parsed = commercialLeadSchema.safeParse(b.dados);
      if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || 'Cadastro inválido.' }, 400);
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      const ipHash = ip ? await hash(ip + key) : null;
      if (ipHash) {
        const { count, error } = await db.from('pec_commercial_leads').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', new Date(Date.now() - 3600000).toISOString());
        if (error) throw error;
        if ((count || 0) >= 10) return json({ error: 'Muitos cadastros. Tente novamente mais tarde.' }, 429);
      }
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
      const { nome, email, whatsapp, empresa } = parsed.data;
      const { error } = await db.from('pec_commercial_leads').insert({ nome, email, whatsapp, empresa, access_hash: await hash(token), ip_hash: ipHash });
      if (error) throw error;
      return json({ token });
    }
    if (typeof b.token !== 'string' || !/^[a-f0-9]{64}$/.test(b.token)) return json({ error: 'Cadastre seu contato para acessar.' }, 401);
    const { data: lead, error } = await db.from('pec_commercial_leads').select('id,empresa,workspace,updated_at').eq('access_hash', await hash(b.token)).maybeSingle();
    if (error) throw error;
    if (!lead) return json({ error: 'Acesso inválido. Faça um novo cadastro.' }, 401);
    const w = lead.workspace;
    if (b.action === 'load' || b.action === 'authorize') return json({ ...w, empresa: { nome: lead.empresa || 'Minha empresa' } });
    const dados = b.dados || {};
    const setor = w.setores.find((s: any) => s.id === b.id);
    switch (b.action) {
      case 'params': w.parametros = dados; break;
      case 'setor_add':
        if (w.setores.length >= 50) return json({ error: 'Limite de setores atingido.' }, 400);
        w.setores.push({ funcionarios_atuais: 0, funcionarios_por_sexo: {}, parciais: { qtd: 0, horas: 0 }, funcionamento: {}, postos: [], intensidade_dias: {}, ...pick(dados), id: crypto.randomUUID() }); break;
      case 'setor_update':
        if (!setor) return json({ error: 'Setor não encontrado.' }, 404);
        Object.assign(setor, pick(dados)); break;
      case 'setor_del':
        if (!setor) return json({ error: 'Setor não encontrado.' }, 404);
        w.setores = w.setores.filter((s: any) => s.id !== b.id); w.datas = w.datas.filter((d: any) => d.setor_id !== b.id); break;
      case 'datas':
        if (!setor || !Array.isArray(dados) || dados.length > 200) return json({ error: 'Datas inválidas.' }, 400);
        w.datas = [...w.datas.filter((d: any) => d.setor_id !== b.id), ...dados.map((d: any) => ({ data: d.data, nivel: d.nivel, observacao: String(d.observacao || '').slice(0, 300), setor_id: b.id }))]; break;
      case 'cenario_add':
        if (w.cenarios.length >= 50) return json({ error: 'Limite de cenários atingido.' }, 400);
        w.cenarios.unshift({ id: crypto.randomUUID(), nome: String(dados.nome || 'Cenário').slice(0, 120), snapshot: dados.snapshot, created_at: new Date().toISOString() }); break;
      case 'cenario_del': w.cenarios = w.cenarios.filter((c: any) => c.id !== b.id); break;
      case 'escala_save': w.escala = dados; break;
      default: return json({ error: 'Ação inválida.' }, 400);
    }
    if (JSON.stringify(w).length > 1000000) return json({ error: 'Limite de dados atingido.' }, 413);
    const { data: updated, error: saveError } = await db.from('pec_commercial_leads').update({ workspace: w }).eq('id', lead.id).eq('updated_at', lead.updated_at).select('id');
    if (saveError) throw saveError;
    if (!updated?.length) return json({ error: 'Outra alteração foi salva. Atualize a página e tente novamente.' }, 409);
    return json({ ok: true, setor: b.action === 'setor_add' ? w.setores.at(-1) : undefined });
  } catch { return json({ error: 'Não foi possível salvar. Tente novamente.' }, 500); }
});