import type { Cliente, ClienteInsert, ClienteUpdate } from "@/types/erp";

export interface ClientesRepository {
  list(): Promise<Cliente[]>;
  getById(id: string): Promise<Cliente | null>;
  search(termo: string): Promise<Cliente[]>;
  create(input: ClienteInsert): Promise<Cliente>;
  update(id: string, patch: ClienteUpdate): Promise<Cliente>;
  remove(id: string): Promise<void>;
}
