/**
 * Testes Reais de Integração Read-Only contra o Supabase Conectado.
 *
 * ATENÇÃO:
 * - Este arquivo executa apenas leituras HTTP REST (`GET` / `SELECT ... LIMIT`).
 * - Nenhuma migration, DDL ou escrita de dados é realizada.
 * - Requer acesso de rede ao endpoint configurado em `.env` (`VITE_SUPABASE_URL`).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";

const ROOT_DIR = path.resolve(import.meta.dir, "..");

function readEnvFile(): Record<string, string> {
  const envPath = path.join(ROOT_DIR, ".env");
  const result: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return result;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

describe("3. Testes de Integração Read-Only (Supabase Real — Sem Escrita)", () => {
  const fileEnv = readEnvFile();
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

  const headers = {
    apikey: (supabaseKey ?? "") as string,
    Authorization: `Bearer ${supabaseKey ?? ""}`,
    Accept: "application/json",
  };

  test("consulta read-only em configuracoes_sistema retorna HTTP 200 e array JSON", async () => {
    expect(Boolean(supabaseUrl)).toBe(true);
    expect(Boolean(supabaseKey)).toBe(true);

    const existingTableRes = await fetch(
      `${supabaseUrl}/rest/v1/configuracoes_sistema?select=chave&limit=1`,
      { method: "GET", headers },
    );
    expect(existingTableRes.status).toBe(200);
    const existingRows = (await existingTableRes.json()) as Array<{ chave: string }>;
    expect(Array.isArray(existingRows)).toBe(true);
  });

  test("inspeciona read-only o estado atual de public.roles para anônimo (pré vs. pós-endurecimento)", async () => {
    expect(Boolean(supabaseUrl)).toBe(true);
    expect(Boolean(supabaseKey)).toBe(true);

    const rolesRes = await fetch(`${supabaseUrl}/rest/v1/roles?select=code,is_system&limit=10`, {
      method: "GET",
      headers,
    });

    // 200 indica que a versão inicial do commit d3611ab (com GRANT SELECT TO anon) já existe no remoto;
    // 401/403 indica o estado endurecido após aplicar a versão revisada da migration (REVOKE ALL ... FROM anon).
    expect([200, 401, 403]).toContain(rolesRes.status);

    if (rolesRes.status === 200) {
      const rolesRows = (await rolesRes.json()) as Array<{ code: string; is_system: boolean }>;
      expect(Array.isArray(rolesRows)).toBe(true);
    }
  });
});
