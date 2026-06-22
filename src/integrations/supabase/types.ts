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
      clientes: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      historico: {
        Row: {
          acao: Database["public"]["Enums"]["historico_acao"]
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          descricao: string | null
          entidade: string
          entidade_id: string
          id: string
          usuario: string | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["historico_acao"]
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          descricao?: string | null
          entidade: string
          entidade_id: string
          id?: string
          usuario?: string | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["historico_acao"]
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          descricao?: string | null
          entidade?: string
          entidade_id?: string
          id?: string
          usuario?: string | null
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          arquivo_nome: string
          atualizados: number
          categoria: Database["public"]["Enums"]["produto_tipo"]
          created_at: string
          erros: number
          erros_detalhe: Json
          id: string
          ignorados: number
          inseridos: number
          status: string
          total_linhas: number
          updated_at: string
          usuario: string | null
        }
        Insert: {
          arquivo_nome: string
          atualizados?: number
          categoria: Database["public"]["Enums"]["produto_tipo"]
          created_at?: string
          erros?: number
          erros_detalhe?: Json
          id?: string
          ignorados?: number
          inseridos?: number
          status?: string
          total_linhas?: number
          updated_at?: string
          usuario?: string | null
        }
        Update: {
          arquivo_nome?: string
          atualizados?: number
          categoria?: Database["public"]["Enums"]["produto_tipo"]
          created_at?: string
          erros?: number
          erros_detalhe?: Json
          id?: string
          ignorados?: number
          inseridos?: number
          status?: string
          total_linhas?: number
          updated_at?: string
          usuario?: string | null
        }
        Relationships: []
      }
      orcamento_itens: {
        Row: {
          altura_cm: number | null
          created_at: string
          descricao: string | null
          id: string
          largura_cm: number | null
          observacoes: string | null
          orcamento_id: string
          produto_id: string | null
          quantidade: number
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          altura_cm?: number | null
          created_at?: string
          descricao?: string | null
          id?: string
          largura_cm?: number | null
          observacoes?: string | null
          orcamento_id: string
          produto_id?: string | null
          quantidade?: number
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          altura_cm?: number | null
          created_at?: string
          descricao?: string | null
          id?: string
          largura_cm?: number | null
          observacoes?: string | null
          orcamento_id?: string
          produto_id?: string | null
          quantidade?: number
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          cliente_id: string | null
          created_at: string
          id: string
          numero_orcamento: number
          observacoes: string | null
          status: Database["public"]["Enums"]["orcamento_status"]
          updated_at: string
          validade: string | null
          valor_total: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          id?: string
          numero_orcamento?: number
          observacoes?: string | null
          status?: Database["public"]["Enums"]["orcamento_status"]
          updated_at?: string
          validade?: string | null
          valor_total?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          id?: string
          numero_orcamento?: number
          observacoes?: string | null
          status?: Database["public"]["Enums"]["orcamento_status"]
          updated_at?: string
          validade?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          created_at: string
          data_pagamento: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          observacoes: string | null
          pedido_id: string
          status: Database["public"]["Enums"]["pagamento_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          pedido_id: string
          status?: Database["public"]["Enums"]["pagamento_status"]
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          pedido_id?: string
          status?: Database["public"]["Enums"]["pagamento_status"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          altura_cm: number | null
          created_at: string
          descricao: string | null
          id: string
          largura_cm: number | null
          observacoes: string | null
          pedido_id: string
          produto_id: string | null
          quantidade: number
          updated_at: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          altura_cm?: number | null
          created_at?: string
          descricao?: string | null
          id?: string
          largura_cm?: number | null
          observacoes?: string | null
          pedido_id: string
          produto_id?: string | null
          quantidade?: number
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          altura_cm?: number | null
          created_at?: string
          descricao?: string | null
          id?: string
          largura_cm?: number | null
          observacoes?: string | null
          pedido_id?: string
          produto_id?: string | null
          quantidade?: number
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          created_at: string
          data_entrega_prevista: string | null
          data_entrega_realizada: string | null
          id: string
          numero_pedido: number
          observacoes: string | null
          orcamento_id: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          updated_at: string
          valor_total: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_entrega_prevista?: string | null
          data_entrega_realizada?: string | null
          id?: string
          numero_pedido?: number
          observacoes?: string | null
          orcamento_id?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          updated_at?: string
          valor_total?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_entrega_prevista?: string | null
          data_entrega_realizada?: string | null
          id?: string
          numero_pedido?: number
          observacoes?: string | null
          orcamento_id?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          acabamento: string | null
          altura_cm: number | null
          ativo: boolean
          codigo: string | null
          created_at: string
          descricao: string | null
          estoque: number
          fabricante: string | null
          id: string
          largura_cm: number | null
          nome: string
          observacoes: string | null
          perfil: string | null
          preco_custo: number
          preco_venda: number
          tipo: Database["public"]["Enums"]["produto_tipo"]
          unidade: string
          updated_at: string
        }
        Insert: {
          acabamento?: string | null
          altura_cm?: number | null
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          estoque?: number
          fabricante?: string | null
          id?: string
          largura_cm?: number | null
          nome: string
          observacoes?: string | null
          perfil?: string | null
          preco_custo?: number
          preco_venda?: number
          tipo?: Database["public"]["Enums"]["produto_tipo"]
          unidade?: string
          updated_at?: string
        }
        Update: {
          acabamento?: string | null
          altura_cm?: number | null
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          estoque?: number
          fabricante?: string | null
          id?: string
          largura_cm?: number | null
          nome?: string
          observacoes?: string | null
          perfil?: string | null
          preco_custo?: number
          preco_venda?: number
          tipo?: Database["public"]["Enums"]["produto_tipo"]
          unidade?: string
          updated_at?: string
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
      forma_pagamento:
        | "dinheiro"
        | "pix"
        | "cartao_credito"
        | "cartao_debito"
        | "transferencia"
        | "boleto"
        | "outro"
      historico_acao: "criado" | "atualizado" | "excluido" | "status_alterado"
      orcamento_status:
        | "rascunho"
        | "enviado"
        | "aprovado"
        | "recusado"
        | "expirado"
        | "convertido"
      pagamento_status:
        | "pendente"
        | "pago"
        | "parcial"
        | "estornado"
        | "cancelado"
      pedido_status:
        | "aguardando_producao"
        | "em_producao"
        | "pronto"
        | "entregue"
        | "cancelado"
      produto_tipo:
        | "moldura"
        | "vidro"
        | "paspatur"
        | "fundo"
        | "acessorio"
        | "servico"
        | "outro"
        | "perfil_moldura"
        | "passe_partout"
        | "protecao_frontal"
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
      forma_pagamento: [
        "dinheiro",
        "pix",
        "cartao_credito",
        "cartao_debito",
        "transferencia",
        "boleto",
        "outro",
      ],
      historico_acao: ["criado", "atualizado", "excluido", "status_alterado"],
      orcamento_status: [
        "rascunho",
        "enviado",
        "aprovado",
        "recusado",
        "expirado",
        "convertido",
      ],
      pagamento_status: [
        "pendente",
        "pago",
        "parcial",
        "estornado",
        "cancelado",
      ],
      pedido_status: [
        "aguardando_producao",
        "em_producao",
        "pronto",
        "entregue",
        "cancelado",
      ],
      produto_tipo: [
        "moldura",
        "vidro",
        "paspatur",
        "fundo",
        "acessorio",
        "servico",
        "outro",
        "perfil_moldura",
        "passe_partout",
        "protecao_frontal",
      ],
    },
  },
} as const
