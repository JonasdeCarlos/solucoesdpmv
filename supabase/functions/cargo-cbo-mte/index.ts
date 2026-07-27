import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type AreaAtividade = { ordem: string; titulo: string; atividades: string[] };

const MTE_BASE = "http://cbo.mte.gov.br";

function decodeHtml(value = "") {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
    Acirc: "Â", Ecirc: "Ê", Ocirc: "Ô", acirc: "â", ecirc: "ê", ocirc: "ô",
    Agrave: "À", agrave: "à", Atilde: "Ã", Otilde: "Õ", atilde: "ã", otilde: "õ",
    Ccedil: "Ç", ccedil: "ç",
  };
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html = "") {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`${name}=(["'])([\\s\\S]*?)\\1`, "i"));
  return m ? decodeHtml(m[2]) : "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractForm(html: string, id: string) {
  const re = new RegExp(`<form\\b(?=[^>]*\\bid=["']${escapeRegExp(id)}["'])[^>]*>[\\s\\S]*?<\\/form>`, "i");
  const form = html.match(re)?.[0] || "";
  const open = form.match(/<form\b[^>]*>/i)?.[0] || "";
  return { html: form, action: attr(open, "action") };
}

function hiddenFields(formHtml: string) {
  const fields: Record<string, string> = {};
  for (const m of formHtml.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const name = attr(tag, "name");
    const type = attr(tag, "type").toLowerCase();
    if (name && (!type || type === "hidden")) fields[name] = attr(tag, "value");
  }
  return fields;
}

function extractJsfField(onclick = "") {
  return onclick.match(/\{'([^']+)':'\1'\}/)?.[1] || onclick.match(/\{'([^']+)':'[^']+'\}/)?.[1] || "";
}

function findAnchorField(formHtml: string, predicate: (text: string, tag: string) => boolean) {
  for (const m of formHtml.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = m[0];
    const text = stripTags(tag);
    if (!predicate(text, tag)) continue;
    const field = extractJsfField(attr(tag.match(/<a\b[^>]*>/i)?.[0] || "", "onclick"));
    if (field) return field;
  }
  return "";
}

function codeDisplay(digits: string) {
  return digits.length === 6 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
}

function parseDescricao(html: string, targetCode: string) {
  const display = codeDisplay(targetCode);
  const familia = stripTags(html.match(/<div[^>]*class=["']titulo_familia["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
  const tituloMatch = targetCode.length === 6
    ? html.match(new RegExp(`<span[^>]*font-weight:\\s*bold[^>]*>\\s*${escapeRegExp(display)}\\s*-\\s*([^<]+)`, "i"))
    : null;
  const titulo = stripTags(tituloMatch?.[1] || familia.replace(/^\d{4}\s*::\s*/, ""));
  const descricao = stripTags(html.match(/<table[^>]*id=["']list3["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
  return { familia, titulo, descricao };
}

function parseAreas(html: string): AreaAtividade[] {
  const start = html.search(/<table[^>]*id=["']formSite019:gacs["']/i);
  const end = start >= 0 ? html.indexOf('<div class="margem"', start) : -1;
  const table = start >= 0 ? html.slice(start, end > start ? end : undefined) : "";
  const chunks = table.split(/<tr\s+class=["'](?:odd|even)["']><td\s+style=["']text-size:12px;["'][^>]*>/i).slice(1);
  return chunks.map((chunk) => {
    const ps = Array.from(chunk.matchAll(/<p[^>]*class=["']texto_normal["'][^>]*>([\s\S]*?)<\/p>/gi)).map((m) => stripTags(m[1])).filter(Boolean);
    const ordem = (ps[0] || "").toUpperCase();
    const titulo = (ps[1] || "").toUpperCase();
    const atividades = ps.slice(2).filter((a) => a && a !== ordem && a.toUpperCase() !== titulo);
    return { ordem, titulo, atividades };
  }).filter((g) => g.ordem && g.titulo);
}

async function tituloDeReferencia(digits: string): Promise<string> {
  // A busca por código do MTE passou a exigir reCAPTCHA; usamos um índice público
  // apenas para descobrir o título oficial e então pesquisar por título no MTE.
  try {
    const url = `https://www.ocupacoes.com.br/cbo/${codeDisplay(digits)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return "";
    const html = await r.text();
    const re = digits.length === 6
      ? new RegExp(`href="/cbo-mte/${digits}-([a-z0-9-]+)"`, "i")
      : new RegExp(`href="/cbo-mte/${digits}-([a-z0-9-]+)"`, "i");
    const slug = html.match(re)?.[1] || "";
    return slug.replace(/-/g, " ").trim();
  } catch {
    return "";
  }
}

async function consultarMte(cbo: string, nome?: string) {
  const digits = cbo.replace(/\D/g, "");
  const display = codeDisplay(digits);
  const cookieJar = new Map<string, string>();

  const updateCookies = (headers: Headers) => {
    const raw = typeof (headers as any).getSetCookie === "function" ? (headers as any).getSetCookie() : [headers.get("set-cookie")].filter(Boolean);
    for (const line of raw as string[]) {
      for (const part of line.split(/,(?=\s*[^;,\s=]+=)/g)) {
        const pair = part.split(";")[0]?.trim();
        const idx = pair.indexOf("=");
        if (idx > 0) cookieJar.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    }
  };
  const cookieHeader = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
  const toUrl = (path: string) => path.startsWith("http") ? path : `${MTE_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const fetchHtml = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", "Mozilla/5.0");
    headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
    if (cookieJar.size) headers.set("Cookie", cookieHeader());
    const response = await fetch(toUrl(path), { ...init, headers });
    updateCookies(response.headers);
    const text = new TextDecoder("iso-8859-1").decode(await response.arrayBuffer());
    if (!response.ok) throw new Error(`MTE retornou HTTP ${response.status}`);
    return { text, url: response.url };
  };
  const postForm = (path: string, fields: Record<string, string>, referer?: string) => fetchHtml(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(referer ? { Referer: referer } : {}) },
    body: new URLSearchParams(fields),
  });

  const somenteLetras = (v = "") => v.replace(/[^A-Za-zÀ-ÿ\s]/g, " ").replace(/\s+/g, " ").trim();
  const termos = Array.from(new Set([
    somenteLetras(await tituloDeReferencia(digits)),
    somenteLetras(nome || ""),
  ].filter((t) => t.length >= 3)));

  let resultado: { text: string; url: string } | null = null;
  let formResultado = { html: "", action: "" };
  let clickCodigo = "";

  for (const termo of termos) {
    const busca = await fetchHtml("/cbosite/pages/pesquisas/BuscaPorTitulo.jsf");
    const formBusca = extractForm(busca.text, "formBuscaPorTitulo");
    if (!formBusca.html) throw new Error("Não foi possível abrir a busca oficial do MTE.");
    const fields = hiddenFields(formBusca.html);
    fields["formBuscaPorTitulo:j_idt80"] = termo;
    fields["formBuscaPorTitulo:btConsultar"] = "Consultar";
    fields["formBuscaPorTitulo:radio"] = "3";
    fields["formBuscaPorTitulo:checkboxFamilias"] = "on";
    fields["formBuscaPorTitulo:checkboxOcupacoes"] = "on";
    fields["formBuscaPorTitulo:checkboxSinonimos"] = "on";
    const page = await postForm(formBusca.action, fields, busca.url);
    const form = extractForm(page.text, "formSite017");
    if (!form.html) continue;
    const linhas = form.html.match(/<tr class=["'](?:odd|even)["'][\s\S]*?<\/tr>/gi) || [];
    for (const linha of linhas) {
      const texto = stripTags(linha);
      const bate = digits.length === 6
        ? texto.includes(display)
        : new RegExp(`\\b${digits}(-\\d{2})?\\b`).test(texto);
      if (!bate) continue;
      const campos = Array.from(linha.matchAll(/\{'(formSite017:objetos:\d+:j_idt\d+)':'\1'\}/g)).map((m) => m[1]);
      clickCodigo = campos[1] || campos[0] || "";
      if (clickCodigo) { resultado = page; formResultado = form; break; }
    }
    if (clickCodigo) break;
  }

  if (!resultado || !clickCodigo) {
    return {
      cbo: display,
      titulo_oficial: "",
      descricao_sumaria: "",
      areas_de_atividade: [] as AreaAtividade[],
      observacao: `Não foi possível localizar o CBO ${display} na busca oficial do MTE (a consulta por código passou a exigir reCAPTCHA; tentamos pela busca por título). Confira o código ou informe o nome do cargo.`,
    };
  }

  const fieldsResultado = hiddenFields(formResultado.html);
  fieldsResultado[clickCodigo] = clickCodigo;
  const descricaoPage = await postForm(formResultado.action, fieldsResultado, resultado.url);
  const desc = parseDescricao(descricaoPage.text, digits);

  const formDesc = extractForm(descricaoPage.text, "formSite004");
  const clickAreas = findAnchorField(formDesc.html, (text) => /Áreas de Atividade/i.test(text));
  if (!formDesc.html || !clickAreas) throw new Error("Não foi possível abrir a aba oficial Áreas de Atividade no MTE.");
  const fieldsDesc = hiddenFields(formDesc.html);
  fieldsDesc[clickAreas] = clickAreas;
  const areasPage = await postForm(formDesc.action, fieldsDesc, descricaoPage.url);

  const formAreas = extractForm(areasPage.text, "formSite019");
  const clickAbrirTodos = findAnchorField(formAreas.html, (_text, tag) => /Abrir todos/i.test(tag));
  let areasHtml = areasPage.text;
  if (formAreas.html && clickAbrirTodos) {
    const fieldsAreas = hiddenFields(formAreas.html);
    fieldsAreas[clickAbrirTodos] = clickAbrirTodos;
    areasHtml = (await postForm(formAreas.action, fieldsAreas, areasPage.url)).text;
  }

  return {
    cbo: display,
    titulo_oficial: desc.titulo,
    descricao_sumaria: desc.descricao,
    areas_de_atividade: parseAreas(areasHtml),
    observacao: "Fonte: site oficial do Ministério do Trabalho (cbo.mte.gov.br).",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { cbo, nome } = await req.json();
    const code = String(cbo || "").replace(/\D/g, "");
    if (!code || !/^\d{4}(\d{2})?$/.test(code)) throw new Error("Informe um código CBO com 4 ou 6 dígitos.");

    const data = await consultarMte(code, typeof nome === "string" ? nome : "");
    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});