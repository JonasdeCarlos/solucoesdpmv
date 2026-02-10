export interface Client {
  id: string;
  nome: string;
  tipo: 'PF' | 'PJ';
  cpf: string;
  cnpj: string;
  endereco: string;
}

export function createEmptyClient(): Client {
  return {
    id: crypto.randomUUID(),
    nome: '',
    tipo: 'PF',
    cpf: '',
    cnpj: '',
    endereco: '',
  };
}
