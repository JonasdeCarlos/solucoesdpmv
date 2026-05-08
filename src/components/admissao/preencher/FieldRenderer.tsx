import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/utils/admissao/formSchema';
import { maskCpf, maskPhone, maskCep } from '@/utils/admissao/validators';

interface Props {
  field: FormField;
  value: any;
  onChange: (v: any) => void;
  error?: string;
}

const FieldRenderer = ({ field, value, onChange, error }: Props) => {
  const id = `f-${field.id}`;
  const common = (
    <>
      <Label htmlFor={id} className="font-medium">
        {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-muted-foreground -mt-1">{field.description}</p>
      )}
    </>
  );

  let control: React.ReactNode = null;
  switch (field.type) {
    case 'short_text':
      control = <Input id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'long_text':
      control = <Textarea id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} rows={4} />;
      break;
    case 'number':
      control = <Input id={id} type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'date':
      control = <Input id={id} type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'email':
      control = <Input id={id} type="email" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'phone':
      control = <Input id={id} value={value || ''} onChange={(e) => onChange(maskPhone(e.target.value))} />;
      break;
    case 'cpf':
      control = <Input id={id} value={value || ''} onChange={(e) => onChange(maskCpf(e.target.value))} placeholder="000.000.000-00" />;
      break;
    case 'cep':
      control = <Input id={id} value={value || ''} onChange={(e) => onChange(maskCep(e.target.value))} placeholder="00000-000" />;
      break;
    case 'dropdown':
      control = (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {(field.options || []).map((o) => (
              <SelectItem key={o.id} value={o.label}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    case 'radio':
      control = (
        <RadioGroup value={value || ''} onValueChange={onChange}>
          {(field.options || []).map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <RadioGroupItem id={`${id}-${o.id}`} value={o.label} />
              <Label htmlFor={`${id}-${o.id}`} className="font-normal">{o.label}</Label>
            </div>
          ))}
        </RadioGroup>
      );
      break;
    case 'checkbox': {
      const arr: string[] = Array.isArray(value) ? value : [];
      control = (
        <div className="space-y-2">
          {(field.options || []).map((o) => {
            const checked = arr.includes(o.label);
            return (
              <div key={o.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-${o.id}`}
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = v ? [...arr, o.label] : arr.filter((x) => x !== o.label);
                    onChange(next);
                  }}
                />
                <Label htmlFor={`${id}-${o.id}`} className="font-normal">{o.label}</Label>
              </div>
            );
          })}
        </div>
      );
      break;
    }
    case 'file':
      control = null; // handled by FileUploadField in parent
      break;
  }

  return (
    <div className="space-y-1.5">
      {common}
      {control}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default FieldRenderer;