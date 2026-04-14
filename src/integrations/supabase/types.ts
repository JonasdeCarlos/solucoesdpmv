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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      banco_horas: {
        Row: {
          created_at: string
          empregado_nome: string
          empresa_nome: string
          id: string
          mes_ano: string
          saldo_final: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empregado_nome: string
          empresa_nome?: string
          id?: string
          mes_ano: string
          saldo_final?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empregado_nome?: string
          empresa_nome?: string
          id?: string
          mes_ano?: string
          saldo_final?: number
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cnpj: string | null
          cpf: string | null
          created_at: string
          endereco: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          tipo?: string
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
      feriados_municipais: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao: string
          id?: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
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
      verbas: {
        Row: {
          calcula_dsr: boolean
          created_at: string
          id: string
          incide_fgts: boolean
          nome: string
          padrao_pd: string
          referencia_padrao: string | null
          tipo_calculo: string
        }
        Insert: {
          calcula_dsr?: boolean
          created_at?: string
          id?: string
          incide_fgts?: boolean
          nome: string
          padrao_pd?: string
          referencia_padrao?: string | null
          tipo_calculo?: string
        }
        Update: {
          calcula_dsr?: boolean
          created_at?: string
          id?: string
          incide_fgts?: boolean
          nome?: string
          padrao_pd?: string
          referencia_padrao?: string | null
          tipo_calculo?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
