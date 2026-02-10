const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const ESPECIAIS = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function groupToWords(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';

  const parts: string[] = [];
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;

  if (c > 0) parts.push(CENTENAS[c]);

  if (d === 1) {
    parts.push(ESPECIAIS[u]);
    return parts.join(' e ');
  }

  if (d > 1) parts.push(DEZENAS[d]);
  if (u > 0) parts.push(UNIDADES[u]);

  return parts.join(' e ');
}

export function numberToWords(value: number): string {
  if (value === 0) return 'zero reais';

  const intPart = Math.floor(Math.abs(value));
  const centsPart = Math.round((Math.abs(value) - intPart) * 100);

  const groups: { value: number; singular: string; plural: string }[] = [
    { value: 0, singular: '', plural: '' },
    { value: 0, singular: 'mil', plural: 'mil' },
    { value: 0, singular: 'milhão', plural: 'milhões' },
    { value: 0, singular: 'bilhão', plural: 'bilhões' },
  ];

  let remaining = intPart;
  for (let i = 0; i < groups.length && remaining > 0; i++) {
    groups[i].value = remaining % 1000;
    remaining = Math.floor(remaining / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g.value === 0) continue;
    const words = groupToWords(g.value);
    if (i === 0) {
      parts.push(words);
    } else {
      parts.push(words ? `${words} ${g.value === 1 ? g.singular : g.plural}` : (g.value === 1 ? g.singular : g.plural));
    }
  }

  let result = '';
  if (parts.length === 0 && intPart === 0) {
    // no integer part
  } else if (parts.length === 1) {
    result = parts[0];
  } else {
    const last = parts.pop()!;
    result = parts.join(', ') + ' e ' + last;
  }

  if (intPart > 0) {
    result += intPart === 1 ? ' real' : ' reais';
  }

  if (centsPart > 0) {
    const centsWords = groupToWords(centsPart);
    if (intPart > 0) result += ' e ';
    result += centsWords + (centsPart === 1 ? ' centavo' : ' centavos');
  }

  if (intPart === 0 && centsPart === 0) return 'zero reais';

  return result.trim();
}
