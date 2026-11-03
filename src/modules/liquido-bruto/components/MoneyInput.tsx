import { Input } from '@/components/ui/input';

/** Campo monetário com máscara BRL: digita só números, preenche da direita (centavos). */
export default function MoneyInput({ value, onChange, id, placeholder }: { value: number; onChange: (v: number) => void; id?: string; placeholder?: string }) {
  const txt = value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        id={id}
        inputMode="numeric"
        className="pl-9 text-right"
        placeholder={placeholder ?? '0,00'}
        value={txt}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '').slice(0, 13);
          onChange(d ? Number(d) / 100 : 0);
        }}
      />
    </div>
  );
}
