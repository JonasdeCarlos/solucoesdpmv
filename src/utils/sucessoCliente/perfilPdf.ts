import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

export async function generatePerfilPdf(params: {
  cliente: any;
  profile: any;
  ccts: any[];
  rubrics: any[];
  diary: any[];
  uploads: any[];
  checklist: any | null;
  risks: any[];
  branding?: { logo_url?: string; primary_color?: string; secondary_color?: string; office_name?: string; phone?: string; email?: string; site?: string };
}) {
  const { cliente, profile, ccts, rubrics, diary, uploads, checklist, risks, branding } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const primary = branding?.primary_color || '#628E3F';
  const secondary = branding?.secondary_color || '#393421';

  const hex = (h: string) => {
    const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
    return [r,g,b] as [number,number,number];
  };
  const [pr,pg,pb] = hex(primary);

  let y = 40;
  // Header
  doc.setFillColor(pr,pg,pb); doc.rect(0,0,W,80,'F');
  if (branding?.logo_url) {
    try {
      const img = await fetch(branding.logo_url).then(r => r.blob()).then(b => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }));
      doc.addImage(img, 'PNG', 20, 15, 50, 50);
    } catch {}
  }
  doc.setTextColor(255,255,255); doc.setFontSize(16); doc.text(branding?.office_name || 'Sucesso do Cliente — DP', 80, 35);
  doc.setFontSize(10); doc.text(`Cliente: ${cliente.nome}`, 80, 55);
  doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 80, 70);
  y = 100;

  const section = (title: string) => {
    doc.setFillColor(pr,pg,pb); doc.rect(20, y, W-40, 18, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(11); doc.text(title, 26, y+13);
    y += 26; doc.setTextColor(0,0,0); doc.setFontSize(9);
  };
  const kv = (k: string, v: any) => { doc.setFont('helvetica','bold'); doc.text(k+':', 26, y); doc.setFont('helvetica','normal'); doc.text(String(v ?? '—'), 130, y, { maxWidth: W-160 }); y += 12; };
  const ensure = (h: number) => { if (y + h > 790) { doc.addPage(); y = 40; } };

  section('Identificação');
  kv('Código', cliente.codigo_cliente || '—');
  kv('Razão Social', cliente.nome);
  kv('Fantasia', cliente.nome_fantasia || '—');
  kv(cliente.tipo === 'PJ' ? 'CNPJ' : 'CPF', cliente.tipo === 'PJ' ? cliente.cnpj : cliente.cpf);
  kv('Município/UF', `${cliente.municipio || '—'}${cliente.uf ? '/'+cliente.uf : ''}`);
  kv('Segmento', cliente.segmento || '—');
  kv('Status', cliente.status);

  if (risks.length > 0) {
    ensure(30); section('⚠ Riscos identificados');
    risks.forEach(r => kv(r.flag_type, `[${r.severity}] ${r.notes || ''}`));
  }

  ensure(40); section('Comunicação / Atendimento');
  if (profile) {
    kv('Contato Digisac', profile.digisac_contact_name || '—');
    kv('Canal padrão', profile.channel_default);
    kv('Melhor horário', profile.best_contact_time || '—');
    kv('SLA interno (h)', profile.sla_hours);
  }

  ensure(40); section('Ponto / Variáveis');
  if (profile) {
    kv('Possui ponto?', profile.has_timeclock ? 'Sim' : 'Não');
    if (profile.has_timeclock) {
      kv('Tipo', profile.timeclock_type);
      kv('Responsável', profile.timeclock_owner);
      if (profile.timeclock_url) kv('URL', profile.timeclock_url);
      if (profile.timeclock_user) kv('Usuário', profile.timeclock_user);
    } else {
      kv('Possui variáveis?', profile.has_variables ? 'Sim' : 'Não');
      if (profile.has_variables) {
        kv('Envio', profile.variables_how);
        kv('Dia limite', profile.variables_deadline_day || '—');
        kv('Responsável', profile.variables_responsible || '—');
      }
    }
  }

  ensure(40); section('Prévia');
  if (profile) {
    kv('Necessita prévia?', profile.needs_preview ? 'Sim' : 'Não');
    if (profile.needs_preview) {
      kv('Prazo (dia)', profile.preview_deadline_day || '—');
      kv('Canal', profile.preview_channel || '—');
      if (profile.preview_rules) kv('Regras', profile.preview_rules);
    }
  }

  ensure(40); section('Carga Horária');
  if (profile) {
    kv('Tipo', profile.workload_type);
    if (profile.workload_type === 'fixa') kv('Jornada', profile.workload_hhmm || '—');
    else if (profile.workload_rules) kv('Regras', profile.workload_rules);
  }

  if (uploads.length > 0) {
    ensure(60); section('Anexos do cliente');
    autoTable(doc, { startY: y, head: [['Tipo','Arquivo','Versão','Data']],
      body: uploads.map(u => [u.upload_type, u.file_name, 'v'+u.version, new Date(u.uploaded_at).toLocaleDateString('pt-BR')]),
      theme: 'grid', headStyles: { fillColor: [pr,pg,pb] }, styles: { fontSize: 8 } });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (ccts.length > 0) {
    ensure(60); section('CCT — Resumo');
    ccts.forEach(c => {
      ensure(40);
      kv('Sindicato', c.sindicato || '—');
      kv('Vigência', `${c.validity_start ? new Date(c.validity_start).toLocaleDateString('pt-BR') : '—'} a ${c.validity_end ? new Date(c.validity_end).toLocaleDateString('pt-BR') : '—'}`);
      if (c.ai_summary) { doc.setFontSize(8); const lines = doc.splitTextToSize(c.ai_summary, W-50); ensure(lines.length*10+10); doc.text(lines, 26, y); y += lines.length*10 + 6; doc.setFontSize(9); }
    });
  }

  if (rubrics.length > 0) {
    ensure(60); section('Rubricas');
    autoTable(doc, { startY: y, head: [['Cód','Nome','Tipo','%','Crítica']],
      body: rubrics.map(r => [r.code, r.name, r.kind, r.percents_text, r.is_critical ? 'Sim' : '']),
      theme: 'grid', headStyles: { fillColor: [pr,pg,pb] }, styles: { fontSize: 8 } });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (diary.length > 0) {
    ensure(60); section('Diário de Particularidades');
    diary.filter(d => !d.archived).slice(0, 30).forEach(d => {
      ensure(20);
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.text(new Date(d.occurred_at).toLocaleDateString('pt-BR') + ' — ' + (d.author_name || ''), 26, y); y += 10;
      doc.setFont('helvetica','normal'); const lines = doc.splitTextToSize(d.text, W-50); ensure(lines.length*10); doc.text(lines, 26, y); y += lines.length*10 + 6;
    });
  }

  if (checklist) {
    ensure(60); section(`Checklist — ${checklist.competence}`);
    autoTable(doc, { startY: y, head: [['#','Etapa','Status','Responsável']],
      body: (checklist.steps_status || []).map((s: any, i: number) => [i+1, s.title, s.status, s.responsible || '']),
      theme: 'grid', headStyles: { fillColor: [pr,pg,pb] }, styles: { fontSize: 8 } });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer em todas as páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFillColor(...hex(secondary)); doc.rect(0, 815, W, 30, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(8);
    const contact = [branding?.office_name, branding?.phone, branding?.email, branding?.site].filter(Boolean).join(' • ');
    doc.text(contact || 'Sucesso do Cliente — DP', W/2, 832, { align: 'center' });
    doc.text(`${i}/${total}`, W-20, 832, { align: 'right' });
  }

  doc.save(`SucessoCliente_${cliente.nome.replace(/\s+/g,'_')}.pdf`);
}

export async function loadBranding() {
  const { data } = await supabase.from('office_branding' as any).select('*').limit(1).maybeSingle();
  if (!data) return undefined;
  const d = data as any;
  let logo_url: string | undefined;
  if (d.logo_path) {
    const { data: u } = await supabase.storage.from('office-assets').createSignedUrl(d.logo_path, 600);
    logo_url = u?.signedUrl;
  }
  return { logo_url, primary_color: d.primary_color, secondary_color: d.secondary_color, office_name: d.office_name, phone: d.phone, email: d.email, site: d.site };
}