/**
 * Compatibility layer for Supabase generated types.
 *
 * This file exists because the current Supabase type generator
 * omits `Relationships` from database Views, which prevents
 * Database["public"] from satisfying GenericSchema.
 *
 * Do NOT edit generated types.ts.
 * Remove this file if a future Supabase CLI version fixes
 * the generated View definitions.
 */

import type { Database } from "./types";

type FixViews<T> = {
  [K in keyof T]: T[K] extends { Row: unknown }
    ? Omit<T[K], "Relationships"> & { Relationships: [] }
    : T[K];
};

export type FixedDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Views" | "Functions" | "Tables"> & {
    Views: FixViews<Database["public"]["Views"]>;
    Tables: Database["public"]["Tables"] & {
      ordem_producao_item_componentes: {
        Row: {
          id: string;
          ordem_producao_item_id: string;
          tipo: "MOLDURA" | "VIDRO" | "FUNDO" | "PASSEPARTOUT" | "CHASSI" | "IMPRESSAO";
          descricao: string;
          ordem: number;
          preparado: boolean;
          preparado_em: string | null;
          preparado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ordem_producao_item_id: string;
          tipo: "MOLDURA" | "VIDRO" | "FUNDO" | "PASSEPARTOUT" | "CHASSI" | "IMPRESSAO";
          descricao: string;
          ordem: number;
          preparado?: boolean;
          preparado_em?: string | null;
          preparado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ordem_producao_item_id?: string;
          tipo?: "MOLDURA" | "VIDRO" | "FUNDO" | "PASSEPARTOUT" | "CHASSI" | "IMPRESSAO";
          descricao?: string;
          ordem?: number;
          preparado?: boolean;
          preparado_em?: string | null;
          preparado_por?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ordem_producao_item_componentes_ordem_producao_item_id_fkey";
            columns: ["ordem_producao_item_id"];
            referencedRelation: "ordem_producao_itens";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Functions: Database["public"]["Functions"] & {
      rpc_reverter_aprovacao_pedido: {
        Args: {
          p_pedido_id: string;
        };
        Returns: void;
      };
      rpc_marcar_componente_preparado: {
        Args: {
          p_componente_id: string;
          p_preparado: boolean;
        };
        Returns: unknown;
      };
      rpc_concluir_item_producao: {
        Args: {
          p_ordem_producao_item_id: string;
          p_pronto: boolean;
        };
        Returns: unknown;
      };
    };
  };
};
