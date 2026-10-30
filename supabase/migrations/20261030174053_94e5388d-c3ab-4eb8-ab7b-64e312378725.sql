CREATE TABLE public.timbrados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  empresa_id uuid NULL REFERENCES public.clientes(id) ON DELETE SET NULL,
  arquivo_path text NOT NULL,
  tipo_arquivo text NOT NULL DEFAULT 'pdf',
  arquivo_primeira_pagina_path text NULL,
  tipo_arquivo_primeira_pagina text NULL,
  margem_superior_mm numeric NOT NULL DEFAULT 35,
  margem_inferior_mm numeric NOT NULL DEFAULT 25,
  margem_esquerda_mm numeric NOT NULL DEFAULT 15,
  margem_direita_mm numeric NOT NULL DEFAULT 15,
  escala_minima numeric NOT NULL DEFAULT 0.80,
  alinhamento_vertical text NOT NULL DEFAULT 'topo',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timbrados_tipo_chk CHECK (tipo_arquivo IN ('pdf','png','jpg')),
  CONSTRAINT timbrados_tipo1_chk CHECK (tipo_arquivo_primeira_pagina IS NULL OR tipo_arquivo_primeira_pagina IN ('pdf','png','jpg')),
  CONSTRAINT timbrados_alinh_chk CHECK (alinhamento_vertical IN ('topo','centro'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timbrados TO authenticated;
GRANT ALL ON public.timbrados TO service_role;
ALTER TABLE public.timbrados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access timbrados" ON public.timbrados FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_timbrados_empresa ON public.timbrados(empresa_id);
CREATE TRIGGER trg_timbrados_updated BEFORE UPDATE ON public.timbrados FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY authenticated_read_timbrados ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'timbrados');
CREATE POLICY authenticated_write_timbrados ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'timbrados');
CREATE POLICY authenticated_update_timbrados ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'timbrados');
CREATE POLICY authenticated_delete_timbrados ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'timbrados');