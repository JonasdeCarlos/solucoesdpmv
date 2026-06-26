
ALTER TABLE public.prize_employees
  ADD COLUMN IF NOT EXISTS codigo_folha text,
  ADD COLUMN IF NOT EXISTS data_admissao date;

ALTER TABLE public.prize_assessment_employees
  ADD COLUMN IF NOT EXISTS elegibilidade text NOT NULL DEFAULT 'pendente';

ALTER TABLE public.prize_assessment_criterion_results
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';

ALTER TABLE public.prize_policies
  ADD COLUMN IF NOT EXISTS minimo_essencial numeric(6,2);
