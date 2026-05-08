export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'email'
  | 'phone'
  | 'cpf'
  | 'cep'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'file';

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: 'Resposta curta',
  long_text: 'Parágrafo',
  number: 'Número',
  date: 'Data',
  email: 'E-mail',
  phone: 'Telefone',
  cpf: 'CPF',
  cep: 'CEP',
  dropdown: 'Lista suspensa',
  radio: 'Múltipla escolha',
  checkbox: 'Caixas de seleção',
  file: 'Upload de arquivo',
};

export interface FieldOption {
  id: string;
  label: string;
}

export interface FormField {
  id: string;
  field_key: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  options?: FieldOption[];
  // upload settings
  multiple?: boolean;
  accept?: string[]; // e.g. ['pdf','jpg','png','heic']
  max_size_mb?: number;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormSchema {
  sections: FormSection[];
}

export function emptySchema(): FormSchema {
  return {
    sections: [
      {
        id: crypto.randomUUID(),
        title: 'Seção 1',
        description: '',
        fields: [],
      },
    ],
  };
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'campo';
}

export function newField(type: FieldType): FormField {
  const base: FormField = {
    id: crypto.randomUUID(),
    field_key: `campo_${Math.random().toString(36).slice(2, 8)}`,
    type,
    label: FIELD_TYPE_LABELS[type],
    description: '',
    required: false,
  };
  if (type === 'dropdown' || type === 'radio' || type === 'checkbox') {
    base.options = [
      { id: crypto.randomUUID(), label: 'Opção 1' },
      { id: crypto.randomUUID(), label: 'Opção 2' },
    ];
  }
  if (type === 'file') {
    base.multiple = false;
    base.accept = ['pdf', 'jpg', 'png', 'heic', 'webp'];
    base.max_size_mb = 20;
  }
  return base;
}

export function getAllFields(schema: FormSchema): FormField[] {
  return schema.sections.flatMap((s) => s.fields);
}

export function findField(schema: FormSchema, fieldKey: string): FormField | undefined {
  return getAllFields(schema).find((f) => f.field_key === fieldKey);
}

export function isFieldEmpty(field: FormField, value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}