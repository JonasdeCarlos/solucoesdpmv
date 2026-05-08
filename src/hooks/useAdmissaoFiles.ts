import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AdmissionFileRow } from '@/utils/admissao/dossieBuilder';

export function useAdmissaoFiles(requestId: string | null) {
  const [files, setFiles] = useState<AdmissionFileRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!requestId) {
      setFiles([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('admission_files' as any)
      .select('*')
      .eq('request_id', requestId)
      .order('sort_order', { ascending: true });
    if (!error && data) setFiles(data as any[]);
    setLoading(false);
  }, [requestId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const uploadFile = async (
    requestId: string,
    fieldKey: string,
    file: File,
    sortOrder: number
  ) => {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `requests/${requestId}/${fieldKey}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('admissao-uploads')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (upErr) return { error: upErr };
    const { error } = await supabase.from('admission_files' as any).insert({
      request_id: requestId,
      field_key: fieldKey,
      original_name: file.name,
      storage_path: path,
      mime_type: file.type || '',
      size_bytes: file.size,
      sort_order: sortOrder,
    } as any);
    if (!error) await fetchAll();
    return { error };
  };

  const deleteFile = async (id: string, storagePath: string) => {
    await supabase.storage.from('admissao-uploads').remove([storagePath]);
    const { error } = await supabase.from('admission_files' as any).delete().eq('id', id);
    if (!error) await fetchAll();
    return { error };
  };

  return { files, loading, uploadFile, deleteFile, fetchAll };
}

export async function listFilesForRequest(requestId: string): Promise<AdmissionFileRow[]> {
  const { data, error } = await supabase
    .from('admission_files' as any)
    .select('*')
    .eq('request_id', requestId)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as any[];
}