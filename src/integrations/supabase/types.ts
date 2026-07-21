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
          endereco: string | null
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
          endereco?: string | null
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
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      configuracoes_sistema: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor: Json
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          pedido_id: string | null
          produto_id: string
          quantidade_barras: number
          quantidade_cm: number
          reserva_id: string | null
          retalho_id: string | null
          saldo_anterior_cm: number
          saldo_posterior_cm: number
          tipo: Database["public"]["Enums"]["estoque_movimento_tipo"]
          usuario: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          pedido_id?: string | null
          produto_id: string
          quantidade_barras?: number
          quantidade_cm: number
          reserva_id?: string | null
          retalho_id?: string | null
          saldo_anterior_cm?: number
          saldo_posterior_cm?: number
          tipo: Database["public"]["Enums"]["estoque_movimento_tipo"]
          usuario?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          pedido_id?: string | null
          produto_id?: string
          quantidade_barras?: number
          quantidade_cm?: number
          reserva_id?: string | null
          retalho_id?: string | null
          saldo_anterior_cm?: number
          saldo_posterior_cm?: number
          tipo?: Database["public"]["Enums"]["estoque_movimento_tipo"]
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_retalho_id_fkey"
            columns: ["retalho_id"]
            isOneToOne: false
            referencedRelation: "retalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabricante_estoque_minimo: {
        Row: {
          created_at: string
          estoque_minimo_barras: number
          fabricante: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estoque_minimo_barras?: number
          fabricante: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estoque_minimo_barras?: number
          fabricante?: string
          id?: string
          updated_at?: string
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
      notificacoes_whatsapp: {
        Row: {
          cliente_id: string | null
          created_at: string
          destinatario: string | null
          enviado_em: string | null
          erro: string | null
          evento: string
          id: string
          mensagem: string
          payload: Json
          pedido_id: string | null
          status: string
          tentativas: number
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          destinatario?: string | null
          enviado_em?: string | null
          erro?: string | null
          evento: string
          id?: string
          mensagem: string
          payload?: Json
          pedido_id?: string | null
          status?: string
          tentativas?: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          destinatario?: string | null
          enviado_em?: string | null
          erro?: string | null
          evento?: string
          id?: string
          mensagem?: string
          payload?: Json
          pedido_id?: string | null
          status?: string
          tentativas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_whatsapp_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_whatsapp_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          altura_cm: number | null
          created_at: string
          descricao: string | null
          id: string
          largura_cm: number | null
          metadados: Json
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
          metadados?: Json
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
          metadados?: Json
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
          metadados: Json
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
          metadados?: Json
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
          metadados?: Json
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
      ordens_producao: {
        Row: {
          altura_arte_cm: number | null
          altura_externa_cm: number | null
          altura_final_cm: number | null
          consumo_fundo_m2: number
          consumo_moldura_cm: number
          consumo_vidro_m2: number
          created_at: string
          fundo_produto_id: string | null
          id: string
          largura_arte_cm: number | null
          largura_externa_cm: number | null
          largura_final_cm: number | null
          metadados: Json
          numero_op: string
          observacao: string | null
          passe_partout_produto_id: string | null
          pedido_id: string
          pedido_item_id: string | null
          perfil_produto_id: string | null
          protecao_produto_id: string | null
          status: Database["public"]["Enums"]["ordem_producao_status"]
          updated_at: string
        }
        Insert: {
          altura_arte_cm?: number | null
          altura_externa_cm?: number | null
          altura_final_cm?: number | null
          consumo_fundo_m2?: number
          consumo_moldura_cm?: number
          consumo_vidro_m2?: number
          created_at?: string
          fundo_produto_id?: string | null
          id?: string
          largura_arte_cm?: number | null
          largura_externa_cm?: number | null
          largura_final_cm?: number | null
          metadados?: Json
          numero_op?: string
          observacao?: string | null
          passe_partout_produto_id?: string | null
          pedido_id: string
          pedido_item_id?: string | null
          perfil_produto_id?: string | null
          protecao_produto_id?: string | null
          status?: Database["public"]["Enums"]["ordem_producao_status"]
          updated_at?: string
        }
        Update: {
          altura_arte_cm?: number | null
          altura_externa_cm?: number | null
          altura_final_cm?: number | null
          consumo_fundo_m2?: number
          consumo_moldura_cm?: number
          consumo_vidro_m2?: number
          created_at?: string
          fundo_produto_id?: string | null
          id?: string
          largura_arte_cm?: number | null
          largura_externa_cm?: number | null
          largura_final_cm?: number | null
          metadados?: Json
          numero_op?: string
          observacao?: string | null
          passe_partout_produto_id?: string | null
          pedido_id?: string
          pedido_item_id?: string | null
          perfil_produto_id?: string | null
          protecao_produto_id?: string | null
          status?: Database["public"]["Enums"]["ordem_producao_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_producao_fundo_produto_id_fkey"
            columns: ["fundo_produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_passe_partout_produto_id_fkey"
            columns: ["passe_partout_produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_perfil_produto_id_fkey"
            columns: ["perfil_produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_protecao_produto_id_fkey"
            columns: ["protecao_produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
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
          metadados: Json
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
          metadados?: Json
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
          metadados?: Json
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
      ordem_producao: {
        Row: {
          id: string
          numero: number
          status: string
          criado_em: string
          atualizado_em: string
          concluido_em: string | null
          criado_por: string | null
          observacoes: string | null
        }
        Insert: {
          id?: string
          numero?: number
          status?: string
          criado_em?: string
          atualizado_em?: string
          concluido_em?: string | null
          criado_por?: string | null
          observacoes?: string | null
        }
        Update: {
          id?: string
          numero?: number
          status?: string
          criado_em?: string
          atualizado_em?: string
          concluido_em?: string | null
          criado_por?: string | null
          observacoes?: string | null
        }
        Relationships: []
      }
      ordem_producao_itens: {
        Row: {
          id: string
          ordem_producao_id: string
          pedido_id: string
          item_pedido_id: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          ordem_producao_id: string
          pedido_id: string
          item_pedido_id: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          ordem_producao_id?: string
          pedido_id?: string
          item_pedido_id?: string
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordem_producao_itens_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordem_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_producao_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_producao_itens_item_pedido_id_fkey"
            columns: ["item_pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          }
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_entrega_prevista: string | null
          data_entrega_realizada: string | null
          data_pedido: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          metadados: Json
          numero_pedido: number
          observacoes: string | null
          orcamento_id: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          updated_at: string
          valor_total: number
          whatsapp_enviado: boolean
          ordem_producao_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_entrega_prevista?: string | null
          data_entrega_realizada?: string | null
          data_pedido?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          metadados?: Json
          numero_pedido?: number
          observacoes?: string | null
          orcamento_id?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          updated_at?: string
          valor_total?: number
          whatsapp_enviado?: boolean
          ordem_producao_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_entrega_prevista?: string | null
          data_entrega_realizada?: string | null
          data_pedido?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          metadados?: Json
          numero_pedido?: number
          observacoes?: string | null
          orcamento_id?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          updated_at?: string
          valor_total?: number
          whatsapp_enviado?: boolean
          ordem_producao_id?: string | null
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
          {
            foreignKeyName: "pedidos_ordem_producao_id_fkey"
            columns: ["ordem_producao_id"]
            isOneToOne: false
            referencedRelation: "ordem_producao"
            referencedColumns: ["id"]
          }
        ]
      }
      produtos: {
        Row: {
          acabamento: string | null
          altura_cm: number | null
          ativo: boolean
          chapa_altura_cm: number | null
          chapa_largura_cm: number | null
          codigo: string | null
          created_at: string
          descricao: string | null
          estoque: number
          estoque_ideal: number
          estoque_minimo: number
          estoque_minimo_barras: number
          fabricante: string | null
          fornecedor: string | null
          id: string
          largura_cm: number | null
          nome: string
          observacoes: string | null
          perfil: string | null
          preco_custo: number
          preco_venda: number
          preco_venda_acima_m2: number | null
          preco_venda_limite_m2: number | null
          tipo: Database["public"]["Enums"]["produto_tipo"]
          unidade: string
          unidade_estoque: string | null
          unidade_venda: string | null
          updated_at: string
        }
        Insert: {
          acabamento?: string | null
          altura_cm?: number | null
          ativo?: boolean
          chapa_altura_cm?: number | null
          chapa_largura_cm?: number | null
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          estoque?: number
          estoque_ideal?: number
          estoque_minimo?: number
          estoque_minimo_barras?: number
          fabricante?: string | null
          fornecedor?: string | null
          id?: string
          largura_cm?: number | null
          nome: string
          observacoes?: string | null
          perfil?: string | null
          preco_custo?: number
          preco_venda?: number
          preco_venda_acima_m2?: number | null
          preco_venda_limite_m2?: number | null
          tipo?: Database["public"]["Enums"]["produto_tipo"]
          unidade?: string
          unidade_estoque?: string | null
          unidade_venda?: string | null
          updated_at?: string
        }
        Update: {
          acabamento?: string | null
          altura_cm?: number | null
          ativo?: boolean
          chapa_altura_cm?: number | null
          chapa_largura_cm?: number | null
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          estoque?: number
          estoque_ideal?: number
          estoque_minimo?: number
          estoque_minimo_barras?: number
          fabricante?: string | null
          fornecedor?: string | null
          id?: string
          largura_cm?: number | null
          nome?: string
          observacoes?: string | null
          perfil?: string | null
          preco_custo?: number
          preco_venda?: number
          preco_venda_acima_m2?: number | null
          preco_venda_limite_m2?: number | null
          tipo?: Database["public"]["Enums"]["produto_tipo"]
          unidade?: string
          unidade_estoque?: string | null
          unidade_venda?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reservas_estoque: {
        Row: {
          comprimento_cm: number
          created_at: string
          id: string
          observacao: string | null
          pedido_id: string
          pedido_item_id: string | null
          produto_id: string
          retalho_id: string | null
          status: Database["public"]["Enums"]["reserva_status"]
          updated_at: string
        }
        Insert: {
          comprimento_cm: number
          created_at?: string
          id?: string
          observacao?: string | null
          pedido_id: string
          pedido_item_id?: string | null
          produto_id: string
          retalho_id?: string | null
          status?: Database["public"]["Enums"]["reserva_status"]
          updated_at?: string
        }
        Update: {
          comprimento_cm?: number
          created_at?: string
          id?: string
          observacao?: string | null
          pedido_id?: string
          pedido_item_id?: string | null
          produto_id?: string
          retalho_id?: string | null
          status?: Database["public"]["Enums"]["reserva_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_estoque_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_estoque_pedido_item_id_fkey"
            columns: ["pedido_item_id"]
            isOneToOne: false
            referencedRelation: "pedido_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_estoque_retalho_id_fkey"
            columns: ["retalho_id"]
            isOneToOne: false
            referencedRelation: "retalhos"
            referencedColumns: ["id"]
          },
        ]
      }
      retalhos: {
        Row: {
          comprimento_cm: number
          created_at: string
          data_corte: string
          data_uso: string | null
          id: string
          observacao: string | null
          origem_pedido_id: string | null
          pedido_uso_id: string | null
          produto_id: string
          status: Database["public"]["Enums"]["retalho_status"]
          updated_at: string
        }
        Insert: {
          comprimento_cm: number
          created_at?: string
          data_corte?: string
          data_uso?: string | null
          id?: string
          observacao?: string | null
          origem_pedido_id?: string | null
          pedido_uso_id?: string | null
          produto_id: string
          status?: Database["public"]["Enums"]["retalho_status"]
          updated_at?: string
        }
        Update: {
          comprimento_cm?: number
          created_at?: string
          data_corte?: string
          data_uso?: string | null
          id?: string
          observacao?: string | null
          origem_pedido_id?: string | null
          pedido_uso_id?: string | null
          produto_id?: string
          status?: Database["public"]["Enums"]["retalho_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retalhos_origem_pedido_id_fkey"
            columns: ["origem_pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retalhos_pedido_uso_id_fkey"
            columns: ["pedido_uso_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retalhos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_consumo_moldura: {
        Args: {
          _altura_final: number
          _larg_perfil: number
          _largura_final: number
        }
        Returns: number
      }
      cfg_num: { Args: { _chave: string; _default: number }; Returns: number }
      consumir_reservas_pedido: {
        Args: { _pedido_id: string }
        Returns: undefined
      }
      estoque_saldo_cm: { Args: { _produto_id: string }; Returns: number }
      estornar_reservas_pedido: {
        Args: { _pedido_id: string }
        Returns: undefined
      }
      processar_reserva_pedido: {
        Args: { _pedido_id: string }
        Returns: undefined
      }
      criar_ordem_producao: {
        Args: {
          p_pedidos_ids: string[]
          p_observacoes: string | null
          p_criado_por: string | null
        }
        Returns: string
      }
      remover_pedido_da_ordem_producao: {
        Args: {
          p_pedido_id: string
          p_motivo: string
          p_usuario_id: string | null
        }
        Returns: undefined
      }
      proximo_codigo_produto: { Args: never; Returns: string }
    }
    Enums: {
      estoque_movimento_tipo:
        | "entrada"
        | "ajuste"
        | "reserva"
        | "estorno_reserva"
        | "consumo"
        | "estorno_consumo"
        | "uso_retalho"
        | "geracao_retalho"
        | "descarte_retalho"
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
      ordem_producao_status:
        | "aberta"
        | "em_andamento"
        | "concluida"
        | "cancelada"
      pagamento_status:
        | "pendente"
        | "pago"
        | "parcial"
        | "estornado"
        | "cancelado"
      pedido_status:
        | "orcamento"
        | "aprovado"
        | "em_producao"
        | "pronto"
        | "entregue"
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
        | "impressao"
        | "chassi"
      reserva_status: "ativa" | "consumida" | "estornada"
      retalho_status: "disponivel" | "usado" | "descartado"
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
      estoque_movimento_tipo: [
        "entrada",
        "ajuste",
        "reserva",
        "estorno_reserva",
        "consumo",
        "estorno_consumo",
        "uso_retalho",
        "geracao_retalho",
        "descarte_retalho",
      ],
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
      ordem_producao_status: [
        "aberta",
        "em_andamento",
        "concluida",
        "cancelada",
      ],
      pagamento_status: [
        "pendente",
        "pago",
        "parcial",
        "estornado",
        "cancelado",
      ],
      pedido_status: [
        "orcamento",
        "aprovado",
        "em_producao",
        "pronto",
        "entregue",
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
        "impressao",
        "chassi",
      ],
      reserva_status: ["ativa", "consumida", "estornada"],
      retalho_status: ["disponivel", "usado", "descartado"],
    },
  },
} as const
