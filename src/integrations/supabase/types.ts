export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admission_archive: {
        Row: {
          admission_completed: boolean
          archived_at: string
          company_cnpj: string
          company_name: string
          employee_name: string
          id: string
          original_created_at: string | null
          original_request_id: string | null
          previous_status: string
          request_snapshot: Json
          responsible_name: string
          template_name: string
        }
        Insert: {
          admission_completed?: boolean
          archived_at?: string
          company_cnpj?: string
          company_name?: string
          employee_name?: string
          id?: string
          original_created_at?: string | null
          original_request_id?: string | null
          previous_status?: string
          request_snapshot?: Json
          responsible_name?: string
          template_name?: string
        }
        Update: {
          admission_completed?: boolean
          archived_at?: string
          company_cnpj?: string
          company_name?: string
          employee_name?: string
          id?: string
          original_created_at?: string | null
          original_request_id?: string | null
          previous_status?: string
          request_snapshot?: Json
          responsible_name?: string
          template_name?: string
        }
        Relationships: []
      }
      admission_dossiers: {
        Row: {
          file_name: string
          generated_at: string
          id: string
          pdf_path: string
          request_id: string
        }
        Insert: {
          file_name?: string
          generated_at?: string
          id?: string
          pdf_path: string
          request_id: string
        }
        Update: {
          file_name?: string
          generated_at?: string
          id?: string
          pdf_path?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_dossiers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "admission_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      admission_files: {
        Row: {
          field_key: string
          id: string
          mime_type: string
          original_name: string
          request_id: string
          size_bytes: number
          sort_order: number
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          field_key: string
          id?: string
          mime_type?: string
          original_name: string
          request_id: string
          size_bytes?: number
          sort_order?: number
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          field_key?: string
          id?: string
          mime_type?: string
          original_name?: string
          request_id?: string
          size_bytes?: number
          sort_order?: number
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_files_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "admission_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      admission_form_templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_published: boolean
          name: string
          schema_json: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          name?: string
          schema_json?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          name?: string
          schema_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      admission_requests: {
        Row: {
          answers: Json
          company_cnpj: string
          company_name: string
          created_at: string
          draft_answers: Json
          employee_name: string
          id: string
          responsible_name: string
          status: string
          submitted_at: string | null
          template_id: string | null
          template_name_snapshot: string
          template_schema_snapshot: Json
          token: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          company_cnpj?: string
          company_name?: string
          created_at?: string
          draft_answers?: Json
          employee_name?: string
          id?: string
          responsible_name?: string
          status?: string
          submitted_at?: string | null
          template_id?: string | null
          template_name_snapshot?: string
          template_schema_snapshot?: Json
          token: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          company_cnpj?: string
          company_name?: string
          created_at?: string
          draft_answers?: Json
          employee_name?: string
          id?: string
          responsible_name?: string
          status?: string
          submitted_at?: string | null
          template_id?: string | null
          template_name_snapshot?: string
          template_schema_snapshot?: Json
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_requests_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "admission_form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          client_id: string | null
          completion_tokens: number
          created_at: string
          credits_estimate: number
          function_name: string
          id: string
          meta: Json | null
          model: string | null
          prompt_tokens: number
          total_tokens: number
        }
        Insert: {
          client_id?: string | null
          completion_tokens?: number
          created_at?: string
          credits_estimate?: number
          function_name: string
          id?: string
          meta?: Json | null
          model?: string | null
          prompt_tokens?: number
          total_tokens?: number
        }
        Update: {
          client_id?: string | null
          completion_tokens?: number
          created_at?: string
          credits_estimate?: number
          function_name?: string
          id?: string
          meta?: Json | null
          model?: string | null
          prompt_tokens?: number
          total_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_acao_files: {
        Row: {
          acao_id: string
          auditoria_id: string
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          size_bytes: number | null
        }
        Insert: {
          acao_id: string
          auditoria_id: string
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Update: {
          acao_id?: string
          auditoria_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_acao_files_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "auditoria_acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_acao_files_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_acoes: {
        Row: {
          acao_corretiva: string
          auditoria_id: string
          created_at: string
          id: string
          item_id: string | null
          prazo: string | null
          prioridade: string
          responsavel: string | null
          status: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          acao_corretiva: string
          auditoria_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel?: string | null
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          acao_corretiva?: string
          auditoria_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          prazo?: string | null
          prioridade?: string
          responsavel?: string | null
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_acoes_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_acoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "auditoria_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_itens: {
        Row: {
          acao: string | null
          area: string
          area_ordem: number | null
          auditoria_id: string
          created_at: string
          descricao: string | null
          documentos: string | null
          id: string
          item_ordem: number | null
          observacoes: string | null
          responsavel_empresa: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          acao?: string | null
          area: string
          area_ordem?: number | null
          auditoria_id: string
          created_at?: string
          descricao?: string | null
          documentos?: string | null
          id?: string
          item_ordem?: number | null
          observacoes?: string | null
          responsavel_empresa?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          acao?: string | null
          area?: string
          area_ordem?: number | null
          auditoria_id?: string
          created_at?: string
          descricao?: string | null
          documentos?: string | null
          id?: string
          item_ordem?: number | null
          observacoes?: string | null
          responsavel_empresa?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_itens_auditoria_id_fkey"
            columns: ["auditoria_id"]
            isOneToOne: false
            referencedRelation: "auditorias"
            referencedColumns: ["id"]
          },
        ]
      }
      auditorias: {
        Row: {
          client_id: string
          cnpj: string | null
          consultor: string | null
          created_at: string
          data_inicio: string | null
          empresa_nome: string
          id: string
          objetivo: string | null
          parecer_final: string | null
          responsavel: string | null
          resumo_diagnostico: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          cnpj?: string | null
          consultor?: string | null
          created_at?: string
          data_inicio?: string | null
          empresa_nome: string
          id?: string
          objetivo?: string | null
          parecer_final?: string | null
          responsavel?: string | null
          resumo_diagnostico?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          cnpj?: string | null
          consultor?: string | null
          created_at?: string
          data_inicio?: string | null
          empresa_nome?: string
          id?: string
          objetivo?: string | null
          parecer_final?: string | null
          responsavel?: string | null
          resumo_diagnostico?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditorias_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      aviso_contact_attempts: {
        Row: {
          attempt_type: string
          aviso_id: string
          call_channel: string | null
          call_date: string | null
          id: string
          marked_at: string
          marked_by: string
          metadata: Json
          notes: string
        }
        Insert: {
          attempt_type: string
          aviso_id: string
          call_channel?: string | null
          call_date?: string | null
          id?: string
          marked_at?: string
          marked_by?: string
          metadata?: Json
          notes?: string
        }
        Update: {
          attempt_type?: string
          aviso_id?: string
          call_channel?: string | null
          call_date?: string | null
          id?: string
          marked_at?: string
          marked_by?: string
          metadata?: Json
          notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "aviso_contact_attempts_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos"
            referencedColumns: ["id"]
          },
        ]
      }
      aviso_empresas: {
        Row: {
          ativo: boolean
          cnpj: string
          code: string
          created_at: string
          digisac_contact_id: string | null
          gestor_digisac_user_id: string | null
          id: string
          name: string
          responsavel: string
          updated_at: string
          whatsapp: string
          whatsapp_numeros: string[]
        }
        Insert: {
          ativo?: boolean
          cnpj?: string
          code: string
          created_at?: string
          digisac_contact_id?: string | null
          gestor_digisac_user_id?: string | null
          id?: string
          name?: string
          responsavel?: string
          updated_at?: string
          whatsapp?: string
          whatsapp_numeros?: string[]
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          code?: string
          created_at?: string
          digisac_contact_id?: string | null
          gestor_digisac_user_id?: string | null
          id?: string
          name?: string
          responsavel?: string
          updated_at?: string
          whatsapp?: string
          whatsapp_numeros?: string[]
        }
        Relationships: []
      }
      aviso_imports: {
        Row: {
          emission_date: string | null
          emission_time: string | null
          errors_json: Json
          file_hash: string | null
          file_name: string
          file_path: string | null
          id: string
          ignorados: number
          imported_at: string
          imported_by: string
          novos: number
          total_empresas: number
          total_rows: number
        }
        Insert: {
          emission_date?: string | null
          emission_time?: string | null
          errors_json?: Json
          file_hash?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          ignorados?: number
          imported_at?: string
          imported_by?: string
          novos?: number
          total_empresas?: number
          total_rows?: number
        }
        Update: {
          emission_date?: string | null
          emission_time?: string | null
          errors_json?: Json
          file_hash?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          ignorados?: number
          imported_at?: string
          imported_by?: string
          novos?: number
          total_empresas?: number
          total_rows?: number
        }
        Relationships: []
      }
      aviso_mensagens_enviadas: {
        Row: {
          created_at: string
          empresa_code: string | null
          empresa_id: string
          empresa_name: string | null
          enviado_por: string | null
          erro: string | null
          id: string
          mensagem: string
          sucesso: boolean
        }
        Insert: {
          created_at?: string
          empresa_code?: string | null
          empresa_id: string
          empresa_name?: string | null
          enviado_por?: string | null
          erro?: string | null
          id?: string
          mensagem: string
          sucesso?: boolean
        }
        Update: {
          created_at?: string
          empresa_code?: string | null
          empresa_id?: string
          empresa_name?: string | null
          enviado_por?: string | null
          erro?: string | null
          id?: string
          mensagem?: string
          sucesso?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "aviso_mensagens_enviadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "aviso_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      aviso_mensagens_modelos: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          texto: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          texto: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          texto?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      avisos: {
        Row: {
          aviso1_at: string | null
          aviso1_by: string | null
          aviso2_at: string | null
          aviso2_by: string | null
          aviso3_at: string | null
          aviso3_by: string | null
          created_at: string
          dedupe_key: string
          due_date: string | null
          employee_code: string
          employee_name: string
          empresa_cnpj: string
          empresa_code: string
          empresa_id: string | null
          empresa_name: string
          id: string
          import_id: string | null
          limit_date: string | null
          motivo: string
          motivo_original: string
          no_response_at: string | null
          no_response_by: string | null
          observacoes: string
          responsavel: string
          source_emission_date: string | null
          status: string
          unique_hash: string
          updated_at: string
        }
        Insert: {
          aviso1_at?: string | null
          aviso1_by?: string | null
          aviso2_at?: string | null
          aviso2_by?: string | null
          aviso3_at?: string | null
          aviso3_by?: string | null
          created_at?: string
          dedupe_key: string
          due_date?: string | null
          employee_code?: string
          employee_name?: string
          empresa_cnpj?: string
          empresa_code?: string
          empresa_id?: string | null
          empresa_name?: string
          id?: string
          import_id?: string | null
          limit_date?: string | null
          motivo?: string
          motivo_original?: string
          no_response_at?: string | null
          no_response_by?: string | null
          observacoes?: string
          responsavel?: string
          source_emission_date?: string | null
          status?: string
          unique_hash: string
          updated_at?: string
        }
        Update: {
          aviso1_at?: string | null
          aviso1_by?: string | null
          aviso2_at?: string | null
          aviso2_by?: string | null
          aviso3_at?: string | null
          aviso3_by?: string | null
          created_at?: string
          dedupe_key?: string
          due_date?: string | null
          employee_code?: string
          employee_name?: string
          empresa_cnpj?: string
          empresa_code?: string
          empresa_id?: string | null
          empresa_name?: string
          id?: string
          import_id?: string | null
          limit_date?: string | null
          motivo?: string
          motivo_original?: string
          no_response_at?: string | null
          no_response_by?: string | null
          observacoes?: string
          responsavel?: string
          source_emission_date?: string | null
          status?: string
          unique_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "aviso_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "aviso_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_envios_log: {
        Row: {
          aviso_id: string | null
          created_at: string
          department_id: string | null
          empresa_id: string | null
          gestor_user_id: string | null
          id: string
          idempotency_key: string | null
          payload_enviado: Json | null
          response_body: Json | null
          response_status: number | null
          sucesso: boolean | null
          ticket_id: string | null
          tipo_aviso: string | null
          transfer_endpoint: string | null
          transfer_ok: boolean | null
          transfer_response: Json | null
        }
        Insert: {
          aviso_id?: string | null
          created_at?: string
          department_id?: string | null
          empresa_id?: string | null
          gestor_user_id?: string | null
          id?: string
          idempotency_key?: string | null
          payload_enviado?: Json | null
          response_body?: Json | null
          response_status?: number | null
          sucesso?: boolean | null
          ticket_id?: string | null
          tipo_aviso?: string | null
          transfer_endpoint?: string | null
          transfer_ok?: boolean | null
          transfer_response?: Json | null
        }
        Update: {
          aviso_id?: string | null
          created_at?: string
          department_id?: string | null
          empresa_id?: string | null
          gestor_user_id?: string | null
          id?: string
          idempotency_key?: string | null
          payload_enviado?: Json | null
          response_body?: Json | null
          response_status?: number | null
          sucesso?: boolean | null
          ticket_id?: string | null
          tipo_aviso?: string | null
          transfer_endpoint?: string | null
          transfer_ok?: boolean | null
          transfer_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "avisos_envios_log_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_envios_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "aviso_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_horas: {
        Row: {
          created_at: string
          empregado_nome: string
          empresa_nome: string
          id: string
          mes_ano: string
          ponto_snapshot: Json | null
          saldo_final: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empregado_nome: string
          empresa_nome?: string
          id?: string
          mes_ano: string
          ponto_snapshot?: Json | null
          saldo_final?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empregado_nome?: string
          empresa_nome?: string
          id?: string
          mes_ano?: string
          ponto_snapshot?: Json | null
          saldo_final?: number
          updated_at?: string
        }
        Relationships: []
      }
      bh_balances: {
        Row: {
          balance_hhmm: string
          balance_minutes: number
          competencia: string
          created_at: string
          employee_id: string
          empresa_cnpj: string
          id: string
          import_id: string | null
          is_current: boolean
          status: string
          version: number
        }
        Insert: {
          balance_hhmm?: string
          balance_minutes?: number
          competencia: string
          created_at?: string
          employee_id: string
          empresa_cnpj?: string
          id?: string
          import_id?: string | null
          is_current?: boolean
          status?: string
          version?: number
        }
        Update: {
          balance_hhmm?: string
          balance_minutes?: number
          competencia?: string
          created_at?: string
          employee_id?: string
          empresa_cnpj?: string
          id?: string
          import_id?: string | null
          is_current?: boolean
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "bh_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "bh_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bh_balances_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bh_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      bh_employees: {
        Row: {
          codigo: string
          created_at: string
          daily_minutes_override: number | null
          empresa_cnpj: string
          empresa_nome: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          codigo?: string
          created_at?: string
          daily_minutes_override?: number | null
          empresa_cnpj?: string
          empresa_nome?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          daily_minutes_override?: number | null
          empresa_cnpj?: string
          empresa_nome?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      bh_imports: {
        Row: {
          competencia: string | null
          empresa_cnpj: string
          empresa_nome: string
          errors_json: Json
          file_hash: string | null
          file_name: string
          file_path: string | null
          id: string
          imported_at: string
          imported_by: string
          total_ok: number
          total_paginas: number
          total_pendentes: number
        }
        Insert: {
          competencia?: string | null
          empresa_cnpj?: string
          empresa_nome?: string
          errors_json?: Json
          file_hash?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          imported_at?: string
          imported_by?: string
          total_ok?: number
          total_paginas?: number
          total_pendentes?: number
        }
        Update: {
          competencia?: string | null
          empresa_cnpj?: string
          empresa_nome?: string
          errors_json?: Json
          file_hash?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          imported_at?: string
          imported_by?: string
          total_ok?: number
          total_paginas?: number
          total_pendentes?: number
        }
        Relationships: []
      }
      bh_settings: {
        Row: {
          daily_minutes: number
          employee_id: string | null
          empresa_cnpj: string | null
          id: string
          scope: string
          trend_threshold_minutes: number
          updated_at: string
        }
        Insert: {
          daily_minutes?: number
          employee_id?: string | null
          empresa_cnpj?: string | null
          id?: string
          scope?: string
          trend_threshold_minutes?: number
          updated_at?: string
        }
        Update: {
          daily_minutes?: number
          employee_id?: string | null
          empresa_cnpj?: string | null
          id?: string
          scope?: string
          trend_threshold_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bh_settings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "bh_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          adequacao: Json | null
          area: string | null
          atividades: Json | null
          cbo: string | null
          client_id: string
          created_at: string
          descricao_sumaria: string | null
          entrevista: string | null
          id: string
          nivel: string | null
          nome: string
          piso_referencia: string | null
          piso_salarial: number | null
          requisitos: Json | null
          salario_atual: number | null
          updated_at: string
        }
        Insert: {
          adequacao?: Json | null
          area?: string | null
          atividades?: Json | null
          cbo?: string | null
          client_id: string
          created_at?: string
          descricao_sumaria?: string | null
          entrevista?: string | null
          id?: string
          nivel?: string | null
          nome: string
          piso_referencia?: string | null
          piso_salarial?: number | null
          requisitos?: Json | null
          salario_atual?: number | null
          updated_at?: string
        }
        Update: {
          adequacao?: Json | null
          area?: string | null
          atividades?: Json | null
          cbo?: string | null
          client_id?: string
          created_at?: string
          descricao_sumaria?: string | null
          entrevista?: string | null
          id?: string
          nivel?: string | null
          nome?: string
          piso_referencia?: string | null
          piso_salarial?: number | null
          requisitos?: Json | null
          salario_atual?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_alerts: {
        Row: {
          alert_type: string
          cct_analysis_id: string | null
          client_cct_id: string | null
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          message: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          cct_analysis_id?: string | null
          client_cct_id?: string | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          cct_analysis_id?: string | null
          client_cct_id?: string | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cct_alerts_cct_analysis_id_fkey"
            columns: ["cct_analysis_id"]
            isOneToOne: false
            referencedRelation: "cct_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cct_alerts_client_cct_id_fkey"
            columns: ["client_cct_id"]
            isOneToOne: false
            referencedRelation: "client_ccts"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_analyses: {
        Row: {
          admission_termination: Json
          ai_model: string | null
          ai_summary: string | null
          ai_version: string | null
          benefits_summary: Json
          client_cct_id: string | null
          confidence_score: number | null
          created_at: string
          created_by: string | null
          dp_attention_points: Json
          economic_clauses: Json
          health_safety: Json
          id: string
          identification: Json
          journey_rules: Json
          ocr_applied: boolean
          ocr_text: string | null
          original_file_name: string | null
          original_file_path: string | null
          overtime_rules: Json
          penalties: Json
          professional_classes: Json
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          territorial_base: Json
          title: string
          union_obligations: Json
          unions: Json
          updated_at: string
          vacation_absence: Json
        }
        Insert: {
          admission_termination?: Json
          ai_model?: string | null
          ai_summary?: string | null
          ai_version?: string | null
          benefits_summary?: Json
          client_cct_id?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          dp_attention_points?: Json
          economic_clauses?: Json
          health_safety?: Json
          id?: string
          identification?: Json
          journey_rules?: Json
          ocr_applied?: boolean
          ocr_text?: string | null
          original_file_name?: string | null
          original_file_path?: string | null
          overtime_rules?: Json
          penalties?: Json
          professional_classes?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          territorial_base?: Json
          title?: string
          union_obligations?: Json
          unions?: Json
          updated_at?: string
          vacation_absence?: Json
        }
        Update: {
          admission_termination?: Json
          ai_model?: string | null
          ai_summary?: string | null
          ai_version?: string | null
          benefits_summary?: Json
          client_cct_id?: string | null
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          dp_attention_points?: Json
          economic_clauses?: Json
          health_safety?: Json
          id?: string
          identification?: Json
          journey_rules?: Json
          ocr_applied?: boolean
          ocr_text?: string | null
          original_file_name?: string | null
          original_file_path?: string | null
          overtime_rules?: Json
          penalties?: Json
          professional_classes?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          territorial_base?: Json
          title?: string
          union_obligations?: Json
          unions?: Json
          updated_at?: string
          vacation_absence?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cct_analyses_client_cct_id_fkey"
            columns: ["client_cct_id"]
            isOneToOne: false
            referencedRelation: "client_ccts"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_analysis_files: {
        Row: {
          cct_analysis_id: string
          created_at: string
          file_kind: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          notes: string | null
          ocr_applied: boolean
          ocr_text: string | null
          order_index: number
          page_count: number | null
          size_bytes: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          cct_analysis_id: string
          created_at?: string
          file_kind?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          ocr_applied?: boolean
          ocr_text?: string | null
          order_index?: number
          page_count?: number | null
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          cct_analysis_id?: string
          created_at?: string
          file_kind?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          ocr_applied?: boolean
          ocr_text?: string | null
          order_index?: number
          page_count?: number | null
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cct_analysis_files_cct_analysis_id_fkey"
            columns: ["cct_analysis_id"]
            isOneToOne: false
            referencedRelation: "cct_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          cct_analysis_id: string | null
          client_id: string | null
          created_at: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          cct_analysis_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          cct_analysis_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cct_audit_log_cct_analysis_id_fkey"
            columns: ["cct_analysis_id"]
            isOneToOne: false
            referencedRelation: "cct_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_benefits: {
        Row: {
          benefit_name: string
          cct_analysis_id: string
          conditions: string | null
          confidence: string | null
          created_at: string
          due_date_rule: string | null
          eligible_employees: string | null
          employee_discount_allowed: boolean | null
          id: string
          notes: string | null
          page_number: number | null
          penalty: string | null
          periodicity: string | null
          source_snippet: string | null
          updated_at: string
          value_amount: number | null
          value_text: string | null
        }
        Insert: {
          benefit_name: string
          cct_analysis_id: string
          conditions?: string | null
          confidence?: string | null
          created_at?: string
          due_date_rule?: string | null
          eligible_employees?: string | null
          employee_discount_allowed?: boolean | null
          id?: string
          notes?: string | null
          page_number?: number | null
          penalty?: string | null
          periodicity?: string | null
          source_snippet?: string | null
          updated_at?: string
          value_amount?: number | null
          value_text?: string | null
        }
        Update: {
          benefit_name?: string
          cct_analysis_id?: string
          conditions?: string | null
          confidence?: string | null
          created_at?: string
          due_date_rule?: string | null
          eligible_employees?: string | null
          employee_discount_allowed?: boolean | null
          id?: string
          notes?: string | null
          page_number?: number | null
          penalty?: string | null
          periodicity?: string | null
          source_snippet?: string | null
          updated_at?: string
          value_amount?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cct_benefits_cct_analysis_id_fkey"
            columns: ["cct_analysis_id"]
            isOneToOne: false
            referencedRelation: "cct_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_clauses: {
        Row: {
          cct_analysis_id: string
          clause_title: string
          clause_type: string | null
          confidence: string | null
          created_at: string
          extracted_text: string | null
          id: string
          order_index: number
          page_number: number | null
          source_snippet: string | null
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          cct_analysis_id: string
          clause_title: string
          clause_type?: string | null
          confidence?: string | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          order_index?: number
          page_number?: number | null
          source_snippet?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          cct_analysis_id?: string
          clause_title?: string
          clause_type?: string | null
          confidence?: string | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          order_index?: number
          page_number?: number | null
          source_snippet?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cct_clauses_cct_analysis_id_fkey"
            columns: ["cct_analysis_id"]
            isOneToOne: false
            referencedRelation: "cct_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_client_links: {
        Row: {
          cct_analysis_id: string
          client_cct_id: string | null
          client_id: string
          created_at: string
          id: string
          linked_at: string
          linked_by: string | null
          status: string
          unlinked_at: string | null
          updated_at: string
        }
        Insert: {
          cct_analysis_id: string
          client_cct_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          linked_at?: string
          linked_by?: string | null
          status?: string
          unlinked_at?: string | null
          updated_at?: string
        }
        Update: {
          cct_analysis_id?: string
          client_cct_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          linked_at?: string
          linked_by?: string | null
          status?: string
          unlinked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cct_client_links_cct_analysis_id_fkey"
            columns: ["cct_analysis_id"]
            isOneToOne: false
            referencedRelation: "cct_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cct_client_links_client_cct_id_fkey"
            columns: ["client_cct_id"]
            isOneToOne: false
            referencedRelation: "client_ccts"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_reports: {
        Row: {
          cct_analysis_id: string
          created_at: string
          generated_at: string
          generated_by: string | null
          id: string
          metadata: Json
          pdf_path: string | null
          report_type: string
          updated_at: string
          whatsapp_text: string | null
        }
        Insert: {
          cct_analysis_id: string
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json
          pdf_path?: string | null
          report_type: string
          updated_at?: string
          whatsapp_text?: string | null
        }
        Update: {
          cct_analysis_id?: string
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          metadata?: Json
          pdf_path?: string | null
          report_type?: string
          updated_at?: string
          whatsapp_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cct_reports_cct_analysis_id_fkey"
            columns: ["cct_analysis_id"]
            isOneToOne: false
            referencedRelation: "cct_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      cct_versions: {
        Row: {
          cct_analysis_id: string
          created_at: string
          created_by: string | null
          file_path_snapshot: string | null
          id: string
          ocr_text_snapshot: string | null
          reason: string | null
          snapshot: Json
          version_number: number
        }
        Insert: {
          cct_analysis_id: string
          created_at?: string
          created_by?: string | null
          file_path_snapshot?: string | null
          id?: string
          ocr_text_snapshot?: string | null
          reason?: string | null
          snapshot: Json
          version_number?: number
        }
        Update: {
          cct_analysis_id?: string
          created_at?: string
          created_by?: string | null
          file_path_snapshot?: string | null
          id?: string
          ocr_text_snapshot?: string | null
          reason?: string | null
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "cct_versions_cct_analysis_id_fkey"
            columns: ["cct_analysis_id"]
            isOneToOne: false
            referencedRelation: "cct_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      ccts: {
        Row: {
          created_at: string
          id: string
          name: string
          observacoes: string
          sindicato: string
          uf: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          observacoes?: string
          sindicato?: string
          uf?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          observacoes?: string
          sindicato?: string
          uf?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      client_audit_log: {
        Row: {
          action: string
          changes: Json
          client_id: string | null
          created_at: string
          id: string
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json
          client_id?: string | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json
          client_id?: string | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_audit_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_calendar_events: {
        Row: {
          client_id: string
          created_at: string
          event_date: string
          event_type: string
          id: string
          notes: string | null
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          event_date: string
          event_type: string
          id?: string
          notes?: string | null
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          notes?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_ccts: {
        Row: {
          abrangencia_territorial: string | null
          ai_clauses: Json
          ai_summary: string | null
          categoria_abrangida: string | null
          cct_analysis_id: string | null
          client_id: string
          codigo_sindicato_dominio: string
          created_at: string
          created_by: string | null
          data_base: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          doc_name: string | null
          doc_path: string | null
          id: string
          instrumento_tipo: string | null
          is_active: boolean
          numero_registro_mte: string | null
          sindicato: string | null
          sindicato_laboral_cnpj: string | null
          sindicato_laboral_endereco: string | null
          sindicato_laboral_nome: string | null
          sindicato_laboral_representante: string | null
          sindicato_patronal_cnpj: string | null
          sindicato_patronal_endereco: string | null
          sindicato_patronal_nome: string | null
          sindicato_patronal_representante: string | null
          uf: string | null
          union_base: string | null
          validity_end: string | null
          validity_start: string | null
          version: number
        }
        Insert: {
          abrangencia_territorial?: string | null
          ai_clauses?: Json
          ai_summary?: string | null
          categoria_abrangida?: string | null
          cct_analysis_id?: string | null
          client_id: string
          codigo_sindicato_dominio?: string
          created_at?: string
          created_by?: string | null
          data_base?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          doc_name?: string | null
          doc_path?: string | null
          id?: string
          instrumento_tipo?: string | null
          is_active?: boolean
          numero_registro_mte?: string | null
          sindicato?: string | null
          sindicato_laboral_cnpj?: string | null
          sindicato_laboral_endereco?: string | null
          sindicato_laboral_nome?: string | null
          sindicato_laboral_representante?: string | null
          sindicato_patronal_cnpj?: string | null
          sindicato_patronal_endereco?: string | null
          sindicato_patronal_nome?: string | null
          sindicato_patronal_representante?: string | null
          uf?: string | null
          union_base?: string | null
          validity_end?: string | null
          validity_start?: string | null
          version?: number
        }
        Update: {
          abrangencia_territorial?: string | null
          ai_clauses?: Json
          ai_summary?: string | null
          categoria_abrangida?: string | null
          cct_analysis_id?: string | null
          client_id?: string
          codigo_sindicato_dominio?: string
          created_at?: string
          created_by?: string | null
          data_base?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          doc_name?: string | null
          doc_path?: string | null
          id?: string
          instrumento_tipo?: string | null
          is_active?: boolean
          numero_registro_mte?: string | null
          sindicato?: string | null
          sindicato_laboral_cnpj?: string | null
          sindicato_laboral_endereco?: string | null
          sindicato_laboral_nome?: string | null
          sindicato_laboral_representante?: string | null
          sindicato_patronal_cnpj?: string | null
          sindicato_patronal_endereco?: string | null
          sindicato_patronal_nome?: string | null
          sindicato_patronal_representante?: string | null
          uf?: string | null
          union_base?: string | null
          validity_end?: string | null
          validity_start?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_ccts_cct_analysis_id_fkey"
            columns: ["cct_analysis_id"]
            isOneToOne: false
            referencedRelation: "cct_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_ccts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_diary_entries: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_by: string | null
          archived_reason: string | null
          attachment_path: string | null
          author_id: string | null
          author_name: string | null
          client_id: string
          created_at: string
          id: string
          occurred_at: string
          tags: Json
          text: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          archived_reason?: string | null
          attachment_path?: string | null
          author_id?: string | null
          author_name?: string | null
          client_id: string
          created_at?: string
          id?: string
          occurred_at?: string
          tags?: Json
          text: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_by?: string | null
          archived_reason?: string | null
          attachment_path?: string | null
          author_id?: string | null
          author_name?: string | null
          client_id?: string
          created_at?: string
          id?: string
          occurred_at?: string
          tags?: Json
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_diary_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_dp_profile: {
        Row: {
          admissao_caminho_dominio: string | null
          admissao_clausulas_especificas: string | null
          admissao_modelo_contrato: string | null
          best_contact_time: string | null
          channel_default: string | null
          client_id: string
          created_at: string
          created_by: string | null
          digisac_contact_id: string | null
          digisac_contact_name: string | null
          empregador_web_password_encrypted: string | null
          empregador_web_url: string | null
          empregador_web_user: string | null
          govbr_duas_etapas: boolean
          has_timeclock: boolean | null
          has_variables: boolean | null
          id: string
          manual_send_frequency: string | null
          manual_send_method: string | null
          needs_preview: boolean | null
          preview_channel: string | null
          preview_deadline_day: number | null
          preview_rules: string | null
          procuracao_conectividade: boolean
          procuracao_empregador_web: boolean
          procuracao_govbr: boolean
          sla_hours: number | null
          sst_contato_email: string
          sst_contato_nome: string
          sst_contato_telefone: string
          sst_empresa: string
          timeclock_notes: string | null
          timeclock_owner: string | null
          timeclock_password_encrypted: string | null
          timeclock_type: string | null
          timeclock_url: string | null
          timeclock_user: string | null
          updated_at: string
          variables_deadline_day: number | null
          variables_how: string | null
          variables_responsible: string | null
          workload_hhmm: string | null
          workload_rules: string | null
          workload_type: string | null
        }
        Insert: {
          admissao_caminho_dominio?: string | null
          admissao_clausulas_especificas?: string | null
          admissao_modelo_contrato?: string | null
          best_contact_time?: string | null
          channel_default?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          digisac_contact_id?: string | null
          digisac_contact_name?: string | null
          empregador_web_password_encrypted?: string | null
          empregador_web_url?: string | null
          empregador_web_user?: string | null
          govbr_duas_etapas?: boolean
          has_timeclock?: boolean | null
          has_variables?: boolean | null
          id?: string
          manual_send_frequency?: string | null
          manual_send_method?: string | null
          needs_preview?: boolean | null
          preview_channel?: string | null
          preview_deadline_day?: number | null
          preview_rules?: string | null
          procuracao_conectividade?: boolean
          procuracao_empregador_web?: boolean
          procuracao_govbr?: boolean
          sla_hours?: number | null
          sst_contato_email?: string
          sst_contato_nome?: string
          sst_contato_telefone?: string
          sst_empresa?: string
          timeclock_notes?: string | null
          timeclock_owner?: string | null
          timeclock_password_encrypted?: string | null
          timeclock_type?: string | null
          timeclock_url?: string | null
          timeclock_user?: string | null
          updated_at?: string
          variables_deadline_day?: number | null
          variables_how?: string | null
          variables_responsible?: string | null
          workload_hhmm?: string | null
          workload_rules?: string | null
          workload_type?: string | null
        }
        Update: {
          admissao_caminho_dominio?: string | null
          admissao_clausulas_especificas?: string | null
          admissao_modelo_contrato?: string | null
          best_contact_time?: string | null
          channel_default?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          digisac_contact_id?: string | null
          digisac_contact_name?: string | null
          empregador_web_password_encrypted?: string | null
          empregador_web_url?: string | null
          empregador_web_user?: string | null
          govbr_duas_etapas?: boolean
          has_timeclock?: boolean | null
          has_variables?: boolean | null
          id?: string
          manual_send_frequency?: string | null
          manual_send_method?: string | null
          needs_preview?: boolean | null
          preview_channel?: string | null
          preview_deadline_day?: number | null
          preview_rules?: string | null
          procuracao_conectividade?: boolean
          procuracao_empregador_web?: boolean
          procuracao_govbr?: boolean
          sla_hours?: number | null
          sst_contato_email?: string
          sst_contato_nome?: string
          sst_contato_telefone?: string
          sst_empresa?: string
          timeclock_notes?: string | null
          timeclock_owner?: string | null
          timeclock_password_encrypted?: string | null
          timeclock_type?: string | null
          timeclock_url?: string | null
          timeclock_user?: string | null
          updated_at?: string
          variables_deadline_day?: number | null
          variables_how?: string | null
          variables_responsible?: string | null
          workload_hhmm?: string | null
          workload_rules?: string | null
          workload_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_dp_profile_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_message_templates: {
        Row: {
          body: string
          category: string
          channel: string
          client_id: string | null
          created_at: string
          id: string
          is_global: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category: string
          channel?: string
          client_id?: string | null
          created_at?: string
          id?: string
          is_global?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          channel?: string
          client_id?: string | null
          created_at?: string
          id?: string
          is_global?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_message_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_prize_links: {
        Row: {
          ativo: boolean
          client_id: string
          created_at: string
          created_by: string | null
          default_verba_label: string
          expira_em: string | null
          id: string
          permissions: Json
          token: string
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          client_id: string
          created_at?: string
          created_by?: string | null
          default_verba_label?: string
          expira_em?: string | null
          id?: string
          permissions?: Json
          token?: string
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          client_id?: string
          created_at?: string
          created_by?: string | null
          default_verba_label?: string
          expira_em?: string | null
          id?: string
          permissions?: Json
          token?: string
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_prize_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_risk_flags: {
        Row: {
          client_id: string
          created_at: string
          flag_type: string
          id: string
          notes: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          flag_type: string
          id?: string
          notes?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          flag_type?: string
          id?: string
          notes?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_risk_flags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_rubrics: {
        Row: {
          client_id: string
          code: string
          created_at: string
          id: string
          incidences: Json
          is_critical: boolean
          kind: string
          name: string
          notes: string | null
          percents_text: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          code: string
          created_at?: string
          id?: string
          incidences?: Json
          is_critical?: boolean
          kind?: string
          name: string
          notes?: string | null
          percents_text?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          code?: string
          created_at?: string
          id?: string
          incidences?: Json
          is_critical?: boolean
          kind?: string
          name?: string
          notes?: string | null
          percents_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_rubrics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_uploads: {
        Row: {
          client_id: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          notes: string | null
          upload_type: string
          uploaded_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          client_id: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          upload_type: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          client_id?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          upload_type?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cnpj: string | null
          codigo_cliente: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          cpf: string | null
          created_at: string
          endereco: string | null
          gestor_carteira: string
          id: string
          municipio: string | null
          nome: string
          nome_fantasia: string | null
          public_feedback_token: string | null
          segmento: string | null
          status: string
          tipo: string
          tipo_folha: string | null
          uf: string | null
        }
        Insert: {
          cnpj?: string | null
          codigo_cliente?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          cpf?: string | null
          created_at?: string
          endereco?: string | null
          gestor_carteira?: string
          id?: string
          municipio?: string | null
          nome: string
          nome_fantasia?: string | null
          public_feedback_token?: string | null
          segmento?: string | null
          status?: string
          tipo?: string
          tipo_folha?: string | null
          uf?: string | null
        }
        Update: {
          cnpj?: string | null
          codigo_cliente?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          cpf?: string | null
          created_at?: string
          endereco?: string | null
          gestor_carteira?: string
          id?: string
          municipio?: string | null
          nome?: string
          nome_fantasia?: string | null
          public_feedback_token?: string | null
          segmento?: string | null
          status?: string
          tipo?: string
          tipo_folha?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      closing_checklist_runs: {
        Row: {
          client_id: string
          competence: string
          created_at: string
          id: string
          steps_status: Json
          template_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          competence: string
          created_at?: string
          id?: string
          steps_status?: Json
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          competence?: string
          created_at?: string
          id?: string
          steps_status?: Json
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "closing_checklist_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_checklist_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "closing_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      closing_checklist_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      cprb_legal_parameters: {
        Row: {
          aliquota_cprb: number
          aliquota_patronal_folha: number
          ano: number
          cnae: string | null
          competencia_fim: string
          competencia_inicio: string
          created_at: string
          fonte_legal: string | null
          id: string
          observacoes_legais: string | null
          percentual_cprb_transicao: number
          percentual_folha_transicao: number
          regra_decimo_terceiro: string | null
          setor: string
          updated_at: string
        }
        Insert: {
          aliquota_cprb: number
          aliquota_patronal_folha?: number
          ano: number
          cnae?: string | null
          competencia_fim: string
          competencia_inicio: string
          created_at?: string
          fonte_legal?: string | null
          id?: string
          observacoes_legais?: string | null
          percentual_cprb_transicao?: number
          percentual_folha_transicao?: number
          regra_decimo_terceiro?: string | null
          setor?: string
          updated_at?: string
        }
        Update: {
          aliquota_cprb?: number
          aliquota_patronal_folha?: number
          ano?: number
          cnae?: string | null
          competencia_fim?: string
          competencia_inicio?: string
          created_at?: string
          fonte_legal?: string | null
          id?: string
          observacoes_legais?: string | null
          percentual_cprb_transicao?: number
          percentual_folha_transicao?: number
          regra_decimo_terceiro?: string | null
          setor?: string
          updated_at?: string
        }
        Relationships: []
      }
      cprb_obras: {
        Row: {
          area_m2: number
          created_at: string
          criterio_rateio: string | null
          folha_obra: number | null
          id: string
          nome: string
          percentual_rateio: number | null
          receita_obra: number | null
          simulation_id: string
        }
        Insert: {
          area_m2?: number
          created_at?: string
          criterio_rateio?: string | null
          folha_obra?: number | null
          id?: string
          nome: string
          percentual_rateio?: number | null
          receita_obra?: number | null
          simulation_id: string
        }
        Update: {
          area_m2?: number
          created_at?: string
          criterio_rateio?: string | null
          folha_obra?: number | null
          id?: string
          nome?: string
          percentual_rateio?: number | null
          receita_obra?: number | null
          simulation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cprb_obras_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "cprb_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      cprb_simulation_results: {
        Row: {
          competencia: string
          contrib_folha_transicao: number | null
          contrib_patronal_folha: number | null
          cprb_valor: number | null
          created_at: string
          custo_cenario_cprb: number | null
          custo_cenario_folha: number | null
          custo_m2_cprb: number | null
          custo_m2_folha: number | null
          custo_mao_obra_cprb: number | null
          custo_mao_obra_folha: number | null
          diferenca_absoluta: number | null
          diferenca_percentual: number | null
          folha_mes: number | null
          id: string
          mes_numero: number
          receita_mes: number | null
          simulation_id: string
        }
        Insert: {
          competencia: string
          contrib_folha_transicao?: number | null
          contrib_patronal_folha?: number | null
          cprb_valor?: number | null
          created_at?: string
          custo_cenario_cprb?: number | null
          custo_cenario_folha?: number | null
          custo_m2_cprb?: number | null
          custo_m2_folha?: number | null
          custo_mao_obra_cprb?: number | null
          custo_mao_obra_folha?: number | null
          diferenca_absoluta?: number | null
          diferenca_percentual?: number | null
          folha_mes?: number | null
          id?: string
          mes_numero: number
          receita_mes?: number | null
          simulation_id: string
        }
        Update: {
          competencia?: string
          contrib_folha_transicao?: number | null
          contrib_patronal_folha?: number | null
          cprb_valor?: number | null
          created_at?: string
          custo_cenario_cprb?: number | null
          custo_cenario_folha?: number | null
          custo_m2_cprb?: number | null
          custo_m2_folha?: number | null
          custo_mao_obra_cprb?: number | null
          custo_mao_obra_folha?: number | null
          diferenca_absoluta?: number | null
          diferenca_percentual?: number | null
          folha_mes?: number | null
          id?: string
          mes_numero?: number
          receita_mes?: number | null
          simulation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cprb_simulation_results_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "cprb_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      cprb_simulations: {
        Row: {
          aliquota_rat_fap: number | null
          aliquota_terceiros: number | null
          cnae: string | null
          cnpj: string | null
          competencia_inicial: string
          created_at: string
          decimo_terceiro: number | null
          empresa_nome: string | null
          folha_total: number | null
          horizonte_meses: number
          id: string
          incluir_decimo_terceiro: boolean | null
          incluir_ferias: boolean | null
          incluir_fgts: boolean | null
          incluir_multa_fgts: boolean | null
          incluir_rat_fap: boolean | null
          incluir_terceiros: boolean | null
          incluir_terco_ferias: boolean | null
          legal_parameter_id: string | null
          nome: string
          percentual_absenteismo: number | null
          percentual_crescimento: number | null
          percentual_multa_fgts: number | null
          percentual_rotatividade: number | null
          pro_labore: number | null
          receita_total: number | null
          regime_tributario: string
          tipo_analise: string
          updated_at: string
        }
        Insert: {
          aliquota_rat_fap?: number | null
          aliquota_terceiros?: number | null
          cnae?: string | null
          cnpj?: string | null
          competencia_inicial: string
          created_at?: string
          decimo_terceiro?: number | null
          empresa_nome?: string | null
          folha_total?: number | null
          horizonte_meses?: number
          id?: string
          incluir_decimo_terceiro?: boolean | null
          incluir_ferias?: boolean | null
          incluir_fgts?: boolean | null
          incluir_multa_fgts?: boolean | null
          incluir_rat_fap?: boolean | null
          incluir_terceiros?: boolean | null
          incluir_terco_ferias?: boolean | null
          legal_parameter_id?: string | null
          nome?: string
          percentual_absenteismo?: number | null
          percentual_crescimento?: number | null
          percentual_multa_fgts?: number | null
          percentual_rotatividade?: number | null
          pro_labore?: number | null
          receita_total?: number | null
          regime_tributario?: string
          tipo_analise?: string
          updated_at?: string
        }
        Update: {
          aliquota_rat_fap?: number | null
          aliquota_terceiros?: number | null
          cnae?: string | null
          cnpj?: string | null
          competencia_inicial?: string
          created_at?: string
          decimo_terceiro?: number | null
          empresa_nome?: string | null
          folha_total?: number | null
          horizonte_meses?: number
          id?: string
          incluir_decimo_terceiro?: boolean | null
          incluir_ferias?: boolean | null
          incluir_fgts?: boolean | null
          incluir_multa_fgts?: boolean | null
          incluir_rat_fap?: boolean | null
          incluir_terceiros?: boolean | null
          incluir_terco_ferias?: boolean | null
          legal_parameter_id?: string | null
          nome?: string
          percentual_absenteismo?: number | null
          percentual_crescimento?: number | null
          percentual_multa_fgts?: number | null
          percentual_rotatividade?: number | null
          pro_labore?: number | null
          receita_total?: number | null
          regime_tributario?: string
          tipo_analise?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cprb_simulations_legal_parameter_id_fkey"
            columns: ["legal_parameter_id"]
            isOneToOne: false
            referencedRelation: "cprb_legal_parameters"
            referencedColumns: ["id"]
          },
        ]
      }
      das_anexos_faixas: {
        Row: {
          aliquota_nominal: number
          anexo: string
          ativo: boolean
          competencia_fim: string
          competencia_inicio: string
          created_at: string
          faixa: number
          fonte_legal: string | null
          id: string
          observacoes: string | null
          parcela_deduzir: number
          rbt12_max: number
          rbt12_min: number
          updated_at: string
        }
        Insert: {
          aliquota_nominal: number
          anexo: string
          ativo?: boolean
          competencia_fim: string
          competencia_inicio: string
          created_at?: string
          faixa: number
          fonte_legal?: string | null
          id?: string
          observacoes?: string | null
          parcela_deduzir?: number
          rbt12_max: number
          rbt12_min?: number
          updated_at?: string
        }
        Update: {
          aliquota_nominal?: number
          anexo?: string
          ativo?: boolean
          competencia_fim?: string
          competencia_inicio?: string
          created_at?: string
          faixa?: number
          fonte_legal?: string | null
          id?: string
          observacoes?: string | null
          parcela_deduzir?: number
          rbt12_max?: number
          rbt12_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      das_cnae_anexo: {
        Row: {
          anexo_sugerido: string
          ativo: boolean
          cnae: string
          created_at: string
          descricao: string | null
          exige_fator_r: boolean
          fator_r_limite: number | null
          id: string
          observacoes: string | null
        }
        Insert: {
          anexo_sugerido: string
          ativo?: boolean
          cnae: string
          created_at?: string
          descricao?: string | null
          exige_fator_r?: boolean
          fator_r_limite?: number | null
          id?: string
          observacoes?: string | null
        }
        Update: {
          anexo_sugerido?: string
          ativo?: boolean
          cnae?: string
          created_at?: string
          descricao?: string | null
          exige_fator_r?: boolean
          fator_r_limite?: number | null
          id?: string
          observacoes?: string | null
        }
        Relationships: []
      }
      dp_segmentos: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      dsr_monthly_results: {
        Row: {
          competencia: string
          detalhe_verbas: Json | null
          dias_dsr: number
          dias_uteis: number
          domingos: number
          empresa_nome: string
          feriados_nao_uteis: number
          gerado_em: string
          id: string
          total_base: number
          total_dsr: number
        }
        Insert: {
          competencia: string
          detalhe_verbas?: Json | null
          dias_dsr?: number
          dias_uteis?: number
          domingos?: number
          empresa_nome?: string
          feriados_nao_uteis?: number
          gerado_em?: string
          id?: string
          total_base?: number
          total_dsr?: number
        }
        Update: {
          competencia?: string
          detalhe_verbas?: Json | null
          dias_dsr?: number
          dias_uteis?: number
          domingos?: number
          empresa_nome?: string
          feriados_nao_uteis?: number
          gerado_em?: string
          id?: string
          total_base?: number
          total_dsr?: number
        }
        Relationships: []
      }
      empregados: {
        Row: {
          cpf: string
          created_at: string
          empresa_nome: string
          funcao: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cpf?: string
          created_at?: string
          empresa_nome?: string
          funcao?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          empresa_nome?: string
          funcao?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      estruturas_salariais: {
        Row: {
          cargos_sugeridos: Json
          client_id: string
          created_at: string
          criterios_manuais: Json
          escala_evolucao: Json
          faixas: Json
          id: string
          organograma: Json
          updated_at: string
        }
        Insert: {
          cargos_sugeridos?: Json
          client_id: string
          created_at?: string
          criterios_manuais?: Json
          escala_evolucao?: Json
          faixas?: Json
          id?: string
          organograma?: Json
          updated_at?: string
        }
        Update: {
          cargos_sugeridos?: Json
          client_id?: string
          created_at?: string
          criterios_manuais?: Json
          escala_evolucao?: Json
          faixas?: Json
          id?: string
          organograma?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estruturas_salariais_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_records: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          employee_name: string
          employee_role: string | null
          fato_ocorrido: string | null
          generated_text: string | null
          id: string
          manager_name: string | null
          pontos_fortes: string | null
          pontos_melhorar: string | null
          public_token: string
          signature_data: string | null
          signed_at: string | null
          signed_by: string | null
          tipo: string
          tom: string | null
          updated_at: string
          view_log: Json
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          employee_name: string
          employee_role?: string | null
          fato_ocorrido?: string | null
          generated_text?: string | null
          id?: string
          manager_name?: string | null
          pontos_fortes?: string | null
          pontos_melhorar?: string | null
          public_token?: string
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          tipo: string
          tom?: string | null
          updated_at?: string
          view_log?: Json
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          employee_name?: string
          employee_role?: string | null
          fato_ocorrido?: string | null
          generated_text?: string | null
          id?: string
          manager_name?: string | null
          pontos_fortes?: string | null
          pontos_melhorar?: string | null
          public_token?: string
          signature_data?: string | null
          signed_at?: string | null
          signed_by?: string | null
          tipo?: string
          tom?: string | null
          updated_at?: string
          view_log?: Json
        }
        Relationships: [
          {
            foreignKeyName: "feedback_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados_municipais: {
        Row: {
          conta_dia_nao_util: boolean
          conta_dsr: boolean
          created_at: string
          data: string
          descricao: string
          escopo: string
          id: string
          municipio: string | null
          uf: string | null
        }
        Insert: {
          conta_dia_nao_util?: boolean
          conta_dsr?: boolean
          created_at?: string
          data: string
          descricao: string
          escopo?: string
          id?: string
          municipio?: string | null
          uf?: string | null
        }
        Update: {
          conta_dia_nao_util?: boolean
          conta_dsr?: boolean
          created_at?: string
          data?: string
          descricao?: string
          escopo?: string
          id?: string
          municipio?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      feriados_nacionais_overrides: {
        Row: {
          ano: number
          chave: string
          created_at: string
          id: string
          ponto_facultativo: boolean
        }
        Insert: {
          ano: number
          chave: string
          created_at?: string
          id?: string
          ponto_facultativo?: boolean
        }
        Update: {
          ano?: number
          chave?: string
          created_at?: string
          id?: string
          ponto_facultativo?: boolean
        }
        Relationships: []
      }
      holiday_audit_log: {
        Row: {
          action: string
          after_json: Json | null
          before_json: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          user_email: string
        }
        Insert: {
          action: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          user_email?: string
        }
        Update: {
          action?: string
          after_json?: Json | null
          before_json?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          user_email?: string
        }
        Relationships: []
      }
      holiday_extraction_items: {
        Row: {
          cct_id: string | null
          confidence: number
          created_at: string
          data: string | null
          evidence_text: string
          holiday_id: string | null
          id: string
          is_holiday: boolean
          is_optional: boolean
          municipio: string | null
          nome: string
          scope_type: string
          source_doc_id: string
          status: string
          tipo: string
          uf: string | null
        }
        Insert: {
          cct_id?: string | null
          confidence?: number
          created_at?: string
          data?: string | null
          evidence_text?: string
          holiday_id?: string | null
          id?: string
          is_holiday?: boolean
          is_optional?: boolean
          municipio?: string | null
          nome?: string
          scope_type?: string
          source_doc_id: string
          status?: string
          tipo?: string
          uf?: string | null
        }
        Update: {
          cct_id?: string | null
          confidence?: number
          created_at?: string
          data?: string | null
          evidence_text?: string
          holiday_id?: string | null
          id?: string
          is_holiday?: boolean
          is_optional?: boolean
          municipio?: string | null
          nome?: string
          scope_type?: string
          source_doc_id?: string
          status?: string
          tipo?: string
          uf?: string | null
        }
        Relationships: []
      }
      holiday_notice_exports: {
        Row: {
          exported_at: string
          exported_by: string
          id: string
          notice_id: string
          pdf_path: string | null
          whatsapp_text: string
        }
        Insert: {
          exported_at?: string
          exported_by?: string
          id?: string
          notice_id: string
          pdf_path?: string | null
          whatsapp_text?: string
        }
        Update: {
          exported_at?: string
          exported_by?: string
          id?: string
          notice_id?: string
          pdf_path?: string | null
          whatsapp_text?: string
        }
        Relationships: []
      }
      holiday_notices: {
        Row: {
          audience: Json
          body_template: string
          created_at: string
          created_by: string
          holiday_ids: string[]
          id: string
          periodo_fim: string | null
          periodo_inicio: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Json
          body_template?: string
          created_at?: string
          created_by?: string
          holiday_ids?: string[]
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          audience?: Json
          body_template?: string
          created_at?: string
          created_by?: string
          holiday_ids?: string[]
          id?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      holiday_source_documents: {
        Row: {
          ano: number | null
          cct_id: string | null
          doc_type: string
          extraction_json: Json
          file_name: string
          file_path: string | null
          id: string
          imported_at: string
          imported_by: string
          municipio: string | null
          status: string
          total_confirmed: number
          total_duplicated: number
          total_extracted: number
          total_ignored: number
          uf: string | null
        }
        Insert: {
          ano?: number | null
          cct_id?: string | null
          doc_type?: string
          extraction_json?: Json
          file_name?: string
          file_path?: string | null
          id?: string
          imported_at?: string
          imported_by?: string
          municipio?: string | null
          status?: string
          total_confirmed?: number
          total_duplicated?: number
          total_extracted?: number
          total_ignored?: number
          uf?: string | null
        }
        Update: {
          ano?: number | null
          cct_id?: string | null
          doc_type?: string
          extraction_json?: Json
          file_name?: string
          file_path?: string | null
          id?: string
          imported_at?: string
          imported_by?: string
          municipio?: string | null
          status?: string
          total_confirmed?: number
          total_duplicated?: number
          total_extracted?: number
          total_ignored?: number
          uf?: string | null
        }
        Relationships: []
      }
      holidays: {
        Row: {
          cct_id: string | null
          company_id: string | null
          created_at: string
          data: string
          dedupe_key: string
          id: string
          is_holiday: boolean
          is_optional: boolean
          municipio: string | null
          nome: string
          observacoes: string
          scope_type: string
          source_doc_id: string | null
          source_type: string
          status: string
          tipo: string
          uf: string | null
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          cct_id?: string | null
          company_id?: string | null
          created_at?: string
          data: string
          dedupe_key?: string
          id?: string
          is_holiday?: boolean
          is_optional?: boolean
          municipio?: string | null
          nome: string
          observacoes?: string
          scope_type?: string
          source_doc_id?: string | null
          source_type?: string
          status?: string
          tipo?: string
          uf?: string | null
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          cct_id?: string | null
          company_id?: string | null
          created_at?: string
          data?: string
          dedupe_key?: string
          id?: string
          is_holiday?: boolean
          is_optional?: boolean
          municipio?: string | null
          nome?: string
          observacoes?: string
          scope_type?: string
          source_doc_id?: string | null
          source_type?: string
          status?: string
          tipo?: string
          uf?: string | null
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      invited_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      office_branding: {
        Row: {
          body_font: string
          brand_manual_url: string | null
          contacts: Json
          created_at: string
          heading_font: string
          id: string
          logo_url: string | null
          office_name: string
          primary_color: string
          secondary_color: string
          text_color: string
          updated_at: string
        }
        Insert: {
          body_font?: string
          brand_manual_url?: string | null
          contacts?: Json
          created_at?: string
          heading_font?: string
          id?: string
          logo_url?: string | null
          office_name?: string
          primary_color?: string
          secondary_color?: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          body_font?: string
          brand_manual_url?: string | null
          contacts?: Json
          created_at?: string
          heading_font?: string
          id?: string
          logo_url?: string | null
          office_name?: string
          primary_color?: string
          secondary_color?: string
          text_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      ponto_ocr_audit: {
        Row: {
          alteracoes_manuais: Json | null
          arquivo_nome: string
          arquivo_path: string | null
          created_at: string
          empregado_nome: string | null
          id: string
          mes_ano: string
          resultado_ocr: Json | null
          status: string
        }
        Insert: {
          alteracoes_manuais?: Json | null
          arquivo_nome: string
          arquivo_path?: string | null
          created_at?: string
          empregado_nome?: string | null
          id?: string
          mes_ano: string
          resultado_ocr?: Json | null
          status?: string
        }
        Update: {
          alteracoes_manuais?: Json | null
          arquivo_nome?: string
          arquivo_path?: string | null
          created_at?: string
          empregado_nome?: string | null
          id?: string
          mes_ano?: string
          resultado_ocr?: Json | null
          status?: string
        }
        Relationships: []
      }
      prize_alignment_reports: {
        Row: {
          assessment_employee_id: string
          assinado_pdf_path: string | null
          created_at: string
          generated_at: string | null
          id: string
          pdf_path: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assessment_employee_id: string
          assinado_pdf_path?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          pdf_path?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assessment_employee_id?: string
          assinado_pdf_path?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          pdf_path?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_alignment_reports_assessment_employee_id_fkey"
            columns: ["assessment_employee_id"]
            isOneToOne: false
            referencedRelation: "prize_assessment_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_assessment_criterion_results: {
        Row: {
          assessment_employee_id: string
          created_at: string
          criterion_id: string
          evidencia_url: string | null
          feedback_ia: string | null
          id: string
          observacao: string | null
          percentual: number
          status: string
          updated_at: string
        }
        Insert: {
          assessment_employee_id: string
          created_at?: string
          criterion_id: string
          evidencia_url?: string | null
          feedback_ia?: string | null
          id?: string
          observacao?: string | null
          percentual?: number
          status?: string
          updated_at?: string
        }
        Update: {
          assessment_employee_id?: string
          created_at?: string
          criterion_id?: string
          evidencia_url?: string | null
          feedback_ia?: string | null
          id?: string
          observacao?: string | null
          percentual?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_assessment_criterion_results_assessment_employee_id_fkey"
            columns: ["assessment_employee_id"]
            isOneToOne: false
            referencedRelation: "prize_assessment_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_assessment_criterion_results_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "prize_criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_assessment_employees: {
        Row: {
          assessment_id: string
          created_at: string
          elegibilidade: string
          employee_id: string
          id: string
          parecer_geral: string | null
          percentual_final: number | null
          status: string
          updated_at: string
          valor_final: number | null
        }
        Insert: {
          assessment_id: string
          created_at?: string
          elegibilidade?: string
          employee_id: string
          id?: string
          parecer_geral?: string | null
          percentual_final?: number | null
          status?: string
          updated_at?: string
          valor_final?: number | null
        }
        Update: {
          assessment_id?: string
          created_at?: string
          elegibilidade?: string
          employee_id?: string
          id?: string
          parecer_geral?: string | null
          percentual_final?: number | null
          status?: string
          updated_at?: string
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_assessment_employees_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "prize_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prize_assessment_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "prize_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_assessments: {
        Row: {
          competencia: string
          created_at: string
          created_by: string | null
          id: string
          observacao: string | null
          policy_id: string
          status: string
          updated_at: string
        }
        Insert: {
          competencia: string
          created_at?: string
          created_by?: string | null
          id?: string
          observacao?: string | null
          policy_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          competencia?: string
          created_at?: string
          created_by?: string | null
          id?: string
          observacao?: string | null
          policy_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_assessments_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "prize_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_criteria: {
        Row: {
          created_at: string
          descricao: string | null
          essencial: boolean
          id: string
          nome: string
          ordem: number
          origem: string
          peso: number
          policy_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          essencial?: boolean
          id?: string
          nome: string
          ordem?: number
          origem?: string
          peso?: number
          policy_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          essencial?: boolean
          id?: string
          nome?: string
          ordem?: number
          origem?: string
          peso?: number
          policy_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_criteria_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "prize_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_dominio_exports: {
        Row: {
          arquivo_path: string
          assessment_id: string
          created_at: string
          created_by: string | null
          id: string
          layout_config: Json | null
          total_linhas: number
          total_valor: number
        }
        Insert: {
          arquivo_path: string
          assessment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          layout_config?: Json | null
          total_linhas?: number
          total_valor?: number
        }
        Update: {
          arquivo_path?: string
          assessment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          layout_config?: Json | null
          total_linhas?: number
          total_valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "prize_dominio_exports_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "prize_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_employees: {
        Row: {
          ativo: boolean
          cargo: string | null
          codigo_folha: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          id: string
          matricula: string | null
          nome: string
          policy_id: string
          pontos: number
          setor: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          codigo_folha?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          id?: string
          matricula?: string | null
          nome: string
          policy_id: string
          pontos?: number
          setor?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          codigo_folha?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          policy_id?: string
          pontos?: number
          setor?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_employees_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "prize_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_policies: {
        Row: {
          arredondamento: string
          aviso_legal: string | null
          client_id: string
          created_at: string
          created_by: string | null
          escopo: string
          hotelaria_apuracao: Json | null
          hotelaria_config: Json | null
          hotelaria_pontos: Json | null
          id: string
          minimo_essencial: number | null
          modelo_template: string | null
          nome: string
          objetivo: string | null
          periodo_tipo: string
          remuneracao_variavel: boolean
          rubrica_codigo: string | null
          rubrica_descricao: string | null
          rv_base: string
          rv_base_label: string | null
          rv_observacoes: string | null
          rv_pct_igualitario: number
          rv_pct_individual: number
          rv_tiers: Json
          status: string
          tipo_calculo: string
          updated_at: string
          valor_base: number
          valor_minimo: number | null
          verba_label: string
          verba_label_plural: string | null
        }
        Insert: {
          arredondamento?: string
          aviso_legal?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          escopo?: string
          hotelaria_apuracao?: Json | null
          hotelaria_config?: Json | null
          hotelaria_pontos?: Json | null
          id?: string
          minimo_essencial?: number | null
          modelo_template?: string | null
          nome: string
          objetivo?: string | null
          periodo_tipo?: string
          remuneracao_variavel?: boolean
          rubrica_codigo?: string | null
          rubrica_descricao?: string | null
          rv_base?: string
          rv_base_label?: string | null
          rv_observacoes?: string | null
          rv_pct_igualitario?: number
          rv_pct_individual?: number
          rv_tiers?: Json
          status?: string
          tipo_calculo?: string
          updated_at?: string
          valor_base?: number
          valor_minimo?: number | null
          verba_label?: string
          verba_label_plural?: string | null
        }
        Update: {
          arredondamento?: string
          aviso_legal?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          escopo?: string
          hotelaria_apuracao?: Json | null
          hotelaria_config?: Json | null
          hotelaria_pontos?: Json | null
          id?: string
          minimo_essencial?: number | null
          modelo_template?: string | null
          nome?: string
          objetivo?: string | null
          periodo_tipo?: string
          remuneracao_variavel?: boolean
          rubrica_codigo?: string | null
          rubrica_descricao?: string | null
          rv_base?: string
          rv_base_label?: string | null
          rv_observacoes?: string | null
          rv_pct_igualitario?: number
          rv_pct_individual?: number
          rv_tiers?: Json
          status?: string
          tipo_calculo?: string
          updated_at?: string
          valor_base?: number
          valor_minimo?: number | null
          verba_label?: string
          verba_label_plural?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      provision_entries: {
        Row: {
          centro_custo: string | null
          colaborador: string | null
          competencia: string
          created_at: string
          empresa_nome: string
          id: string
          observacao: string | null
          quantidade: number | null
          tipo_lancamento: string
          updated_at: string
          valor: number
          valor_unitario: number | null
          verba_id: string | null
        }
        Insert: {
          centro_custo?: string | null
          colaborador?: string | null
          competencia: string
          created_at?: string
          empresa_nome?: string
          id?: string
          observacao?: string | null
          quantidade?: number | null
          tipo_lancamento?: string
          updated_at?: string
          valor?: number
          valor_unitario?: number | null
          verba_id?: string | null
        }
        Update: {
          centro_custo?: string | null
          colaborador?: string | null
          competencia?: string
          created_at?: string
          empresa_nome?: string
          id?: string
          observacao?: string | null
          quantidade?: number | null
          tipo_lancamento?: string
          updated_at?: string
          valor?: number
          valor_unitario?: number | null
          verba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provision_entries_verba_id_fkey"
            columns: ["verba_id"]
            isOneToOne: false
            referencedRelation: "verbas"
            referencedColumns: ["id"]
          },
        ]
      }
      rescisao_cover_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          template_pdf_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          template_pdf_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          template_pdf_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rescisao_dossier_files: {
        Row: {
          doc_category: string
          dossier_id: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          pages: number | null
          sort_order: number
          uploaded_at: string
        }
        Insert: {
          doc_category?: string
          dossier_id: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          pages?: number | null
          sort_order?: number
          uploaded_at?: string
        }
        Update: {
          doc_category?: string
          dossier_id?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          pages?: number | null
          sort_order?: number
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rescisao_dossier_files_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "rescisao_dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      rescisao_dossiers: {
        Row: {
          checked_by: string | null
          company_cnpj: string | null
          company_name: string | null
          competence_month: string | null
          created_at: string
          employee_name: string
          final_pdf_url: string | null
          id: string
          payment_date_final: string | null
          payment_date_suggested: string | null
          status: string
          termination_date: string
          updated_at: string
        }
        Insert: {
          checked_by?: string | null
          company_cnpj?: string | null
          company_name?: string | null
          competence_month?: string | null
          created_at?: string
          employee_name: string
          final_pdf_url?: string | null
          id?: string
          payment_date_final?: string | null
          payment_date_suggested?: string | null
          status?: string
          termination_date: string
          updated_at?: string
        }
        Update: {
          checked_by?: string | null
          company_cnpj?: string | null
          company_name?: string | null
          competence_month?: string | null
          created_at?: string
          employee_name?: string
          final_pdf_url?: string | null
          id?: string
          payment_date_final?: string | null
          payment_date_suggested?: string | null
          status?: string
          termination_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      sero_deducoes: {
        Row: {
          competencia: string | null
          created_at: string
          id: string
          nf_numero: string | null
          nf_path: string | null
          obra_id: string
          tipo: string
          valor: number
        }
        Insert: {
          competencia?: string | null
          created_at?: string
          id?: string
          nf_numero?: string | null
          nf_path?: string | null
          obra_id: string
          tipo: string
          valor?: number
        }
        Update: {
          competencia?: string | null
          created_at?: string
          id?: string
          nf_numero?: string | null
          nf_path?: string | null
          obra_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "sero_deducoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "sero_obras"
            referencedColumns: ["id"]
          },
        ]
      }
      sero_obras: {
        Row: {
          area_complementar: number
          area_principal: number
          categoria: string
          cno: string
          contabilidade_regular: boolean
          created_at: string
          data_inicio: string
          data_termino: string | null
          data_termino_previsto: string | null
          encargos_projetados: number | null
          endereco: string | null
          folha_total_projetada: number | null
          folha_vinculada_id: string | null
          id: string
          municipio: string
          observacoes_analista: string | null
          rateio_tipo: string | null
          rateio_valor: number | null
          responsavel_doc: string | null
          responsavel_nome: string | null
          responsavel_tipo: string
          status: string
          tecnica_construtiva: string
          tipo_obra: string
          uf: string
          updated_at: string
        }
        Insert: {
          area_complementar?: number
          area_principal?: number
          categoria?: string
          cno: string
          contabilidade_regular?: boolean
          created_at?: string
          data_inicio: string
          data_termino?: string | null
          data_termino_previsto?: string | null
          encargos_projetados?: number | null
          endereco?: string | null
          folha_total_projetada?: number | null
          folha_vinculada_id?: string | null
          id?: string
          municipio?: string
          observacoes_analista?: string | null
          rateio_tipo?: string | null
          rateio_valor?: number | null
          responsavel_doc?: string | null
          responsavel_nome?: string | null
          responsavel_tipo?: string
          status?: string
          tecnica_construtiva?: string
          tipo_obra?: string
          uf?: string
          updated_at?: string
        }
        Update: {
          area_complementar?: number
          area_principal?: number
          categoria?: string
          cno?: string
          contabilidade_regular?: boolean
          created_at?: string
          data_inicio?: string
          data_termino?: string | null
          data_termino_previsto?: string | null
          encargos_projetados?: number | null
          endereco?: string | null
          folha_total_projetada?: number | null
          folha_vinculada_id?: string | null
          id?: string
          municipio?: string
          observacoes_analista?: string | null
          rateio_tipo?: string | null
          rateio_valor?: number | null
          responsavel_doc?: string | null
          responsavel_nome?: string | null
          responsavel_tipo?: string
          status?: string
          tecnica_construtiva?: string
          tipo_obra?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      sero_parametros: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: number
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      sero_retencoes: {
        Row: {
          aliquota_retencao: number
          cnpj_fornecedor: string | null
          competencia: string | null
          created_at: string
          fornecedor_nome: string | null
          id: string
          nf_path: string | null
          obra_id: string
          retencao_valor: number
          valor_bruto: number
        }
        Insert: {
          aliquota_retencao?: number
          cnpj_fornecedor?: string | null
          competencia?: string | null
          created_at?: string
          fornecedor_nome?: string | null
          id?: string
          nf_path?: string | null
          obra_id: string
          retencao_valor?: number
          valor_bruto?: number
        }
        Update: {
          aliquota_retencao?: number
          cnpj_fornecedor?: string | null
          competencia?: string | null
          created_at?: string
          fornecedor_nome?: string | null
          id?: string
          nf_path?: string | null
          obra_id?: string
          retencao_valor?: number
          valor_bruto?: number
        }
        Relationships: [
          {
            foreignKeyName: "sero_retencoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "sero_obras"
            referencedColumns: ["id"]
          },
        ]
      }
      sero_vau_val: {
        Row: {
          competencia_fim: string
          competencia_inicio: string
          created_at: string
          fonte: string | null
          id: string
          percentual_concreto: number
          tipo_obra: string
          uf: string
          updated_at: string
          valor_m2: number
        }
        Insert: {
          competencia_fim: string
          competencia_inicio: string
          created_at?: string
          fonte?: string | null
          id?: string
          percentual_concreto?: number
          tipo_obra?: string
          uf?: string
          updated_at?: string
          valor_m2: number
        }
        Update: {
          competencia_fim?: string
          competencia_inicio?: string
          created_at?: string
          fonte?: string | null
          id?: string
          percentual_concreto?: number
          tipo_obra?: string
          uf?: string
          updated_at?: string
          valor_m2?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vacation_calculations: {
        Row: {
          abono_days: number
          abono_enabled: boolean
          abono_one_third_value: number
          abono_value: number
          acquisition_end: string
          acquisition_start: string
          avg_variables: number
          base_remuneration: number
          company_doc: string
          company_id: string | null
          company_name: string
          concession_end: string
          concession_start: string
          created_at: string
          created_by: string | null
          department: string | null
          discounts_desc: string | null
          discounts_value: number
          employee_cpf: string
          employee_name: string
          fraction_description: string | null
          gross_total: number
          id: string
          leave_end: string
          leave_start: string
          net_total: number
          one_third_value: number
          other_pay_items: number
          pay_date: string
          pay_method: string
          pis: string | null
          registration: string | null
          responsible_cpf: string | null
          responsible_name: string | null
          responsible_role: string | null
          return_date: string
          role: string | null
          salary_base: number
          signature_date: string
          signature_place: string
          updated_at: string
          vacation_days: number
          vacation_type: string
          vacation_value: number
        }
        Insert: {
          abono_days?: number
          abono_enabled?: boolean
          abono_one_third_value?: number
          abono_value?: number
          acquisition_end: string
          acquisition_start: string
          avg_variables?: number
          base_remuneration?: number
          company_doc?: string
          company_id?: string | null
          company_name?: string
          concession_end: string
          concession_start: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          discounts_desc?: string | null
          discounts_value?: number
          employee_cpf: string
          employee_name: string
          fraction_description?: string | null
          gross_total?: number
          id?: string
          leave_end: string
          leave_start: string
          net_total?: number
          one_third_value?: number
          other_pay_items?: number
          pay_date: string
          pay_method?: string
          pis?: string | null
          registration?: string | null
          responsible_cpf?: string | null
          responsible_name?: string | null
          responsible_role?: string | null
          return_date: string
          role?: string | null
          salary_base?: number
          signature_date?: string
          signature_place?: string
          updated_at?: string
          vacation_days?: number
          vacation_type?: string
          vacation_value?: number
        }
        Update: {
          abono_days?: number
          abono_enabled?: boolean
          abono_one_third_value?: number
          abono_value?: number
          acquisition_end?: string
          acquisition_start?: string
          avg_variables?: number
          base_remuneration?: number
          company_doc?: string
          company_id?: string | null
          company_name?: string
          concession_end?: string
          concession_start?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          discounts_desc?: string | null
          discounts_value?: number
          employee_cpf?: string
          employee_name?: string
          fraction_description?: string | null
          gross_total?: number
          id?: string
          leave_end?: string
          leave_start?: string
          net_total?: number
          one_third_value?: number
          other_pay_items?: number
          pay_date?: string
          pay_method?: string
          pis?: string | null
          registration?: string | null
          responsible_cpf?: string | null
          responsible_name?: string | null
          responsible_role?: string | null
          return_date?: string
          role?: string | null
          salary_base?: number
          signature_date?: string
          signature_place?: string
          updated_at?: string
          vacation_days?: number
          vacation_type?: string
          vacation_value?: number
        }
        Relationships: []
      }
      vacation_receipts: {
        Row: {
          calculation_id: string
          created_at: string
          file_name: string
          id: string
          pdf_data: Json
          template_version: string
        }
        Insert: {
          calculation_id: string
          created_at?: string
          file_name?: string
          id?: string
          pdf_data?: Json
          template_version?: string
        }
        Update: {
          calculation_id?: string
          created_at?: string
          file_name?: string
          id?: string
          pdf_data?: Json
          template_version?: string
        }
        Relationships: []
      }
      verbas: {
        Row: {
          calcula_dsr: boolean
          codigo: string | null
          considera_domingo_dsr: boolean
          considera_feriado_dsr: boolean
          created_at: string
          id: string
          incide_dsr: boolean
          incide_fgts: boolean
          nome: string
          observacoes: string | null
          padrao_pd: string
          referencia_padrao: string | null
          regra_dsr: string
          regra_dsr_custom: string | null
          tipo_calculo: string
          tipo_lancamento: string
        }
        Insert: {
          calcula_dsr?: boolean
          codigo?: string | null
          considera_domingo_dsr?: boolean
          considera_feriado_dsr?: boolean
          created_at?: string
          id?: string
          incide_dsr?: boolean
          incide_fgts?: boolean
          nome: string
          observacoes?: string | null
          padrao_pd?: string
          referencia_padrao?: string | null
          regra_dsr?: string
          regra_dsr_custom?: string | null
          tipo_calculo?: string
          tipo_lancamento?: string
        }
        Update: {
          calcula_dsr?: boolean
          codigo?: string | null
          considera_domingo_dsr?: boolean
          considera_feriado_dsr?: boolean
          created_at?: string
          id?: string
          incide_dsr?: boolean
          incide_fgts?: boolean
          nome?: string
          observacoes?: string | null
          padrao_pd?: string
          referencia_padrao?: string | null
          regra_dsr?: string
          regra_dsr_custom?: string | null
          tipo_calculo?: string
          tipo_lancamento?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_empregador_web_password: {
        Args: { _client_id: string }
        Returns: string
      }
      get_timeclock_password: { Args: { _client_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_master: { Args: { _user_id: string }; Returns: boolean }
      normalize_email: { Args: { _email: string }; Returns: string }
      set_empregador_web_password: {
        Args: { _client_id: string; _password: string }
        Returns: undefined
      }
      set_timeclock_password: {
        Args: { _client_id: string; _password: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "master" | "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["master", "admin", "user"],
    },
  },
} as const
