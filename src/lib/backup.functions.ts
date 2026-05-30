import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin as _supabaseAdmin } from "@/integrations/supabase/client.server";
// Cast to any: BACKUP_TABLES is a runtime list of arbitrary table names and
// rows are arbitrary JSON shapes from a backup file — strict generic typing
// is intentionally bypassed for this admin-only tool.
const supabaseAdmin = _supabaseAdmin as unknown as {
  from: (t: string) => any;
};

// Canonical table list to back up / restore. Keys are stable identifiers used
// in the JSON file and in module groupings; values are the real table names.
export const BACKUP_TABLES = [
  "user_profiles",
  "user_roles",
  "user_preferences",
  "registrations",
  "retreat_registrations",
  "attendance_records",
  "meal_plans",
  "events",
  "home_page_settings",
  "messages",
  "chat_messages",
  "service_applications",
  "sunday_school_checkins",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

// Module groupings for selective restore.
export const RESTORE_GROUPS: Record<string, BackupTable[]> = {
  admins: ["user_profiles", "user_roles", "user_preferences"],
  newcomers: ["registrations"],
  retreat: ["retreat_registrations"],
  welcome: ["attendance_records", "sunday_school_checkins"],
  meals: ["meal_plans"],
  home: ["home_page_settings", "events"],
  chat: ["chat_messages", "messages"],
};

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin required");
}

// ---------- Backup ----------
export const exportBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const tables: Record<string, any[]> = {};
    const warnings: string[] = [];
    for (const t of BACKUP_TABLES) {
      const { data, error } = await supabaseAdmin.from(t).select("*");
      if (error) {
        warnings.push(`${t}: ${error.message}`);
        tables[t] = [];
      } else {
        tables[t] = data ?? [];
      }
    }
    return {
      backup_version: 1,
      created_at: new Date().toISOString(),
      project_name: "HOC3 Ministry Center",
      tables: tables as any,
      warnings,
    } as any;
  });

// ---------- Restore ----------
const RestoreInput = z.object({
  payload: z.object({
    backup_version: z.number().optional(),
    created_at: z.string().optional(),
    project_name: z.string().optional(),
    tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  }),
  groups: z.array(z.string()).optional(), // empty/undefined = all
});

type TableResult = {
  table: string;
  inserted: number;
  failed: number;
  error?: string;
  warnings: string[];
};

function pickFilter(table: string) {
  // Each table needs a WHERE filter for DELETE in supabase-js.
  if (table === "user_preferences" || table === "user_presence") {
    return { col: "user_id", val: "00000000-0000-0000-0000-000000000000" };
  }
  return { col: "id", val: "00000000-0000-0000-0000-000000000000" };
}

async function restoreTable(table: string, rows: any[]): Promise<TableResult> {
  const res: TableResult = { table, inserted: 0, failed: 0, warnings: [] };
  // Wipe existing rows.
  const f = pickFilter(table);
  const del = await supabaseAdmin.from(table).delete().neq(f.col, f.val);
  if (del.error) {
    res.error = `delete failed: ${del.error.message}`;
    return res;
  }
  if (!rows || rows.length === 0) return res;

  // Try bulk insert first; on error, fall back to row-by-row and strip
  // columns that the destination schema rejects.
  const bulk = await supabaseAdmin.from(table).insert(rows).select("*");
  if (!bulk.error) {
    res.inserted = bulk.data?.length ?? rows.length;
    return res;
  }

  res.warnings.push(`bulk insert rejected (${bulk.error.message}); retrying row-by-row`);

  const droppedCols = new Set<string>();
  for (const original of rows as Record<string, any>[]) {
    const row: Record<string, any> = { ...original };
    // Pre-strip known-bad columns from previous failures.
    for (const c of droppedCols) delete row[c];
    let attempt = 0;
    while (attempt < 5) {
      const r = await supabaseAdmin.from(table).insert(row);
      if (!r.error) {
        res.inserted++;
        break;
      }
      const msg = r.error.message || "";
      // Postgres: "Could not find the 'X' column" / "column \"X\" of relation"
      const m = msg.match(/'([^']+)' column|column "([^"]+)"/);
      const badCol = m?.[1] || m?.[2];
      if (badCol && badCol in row) {
        droppedCols.add(badCol);
        delete row[badCol];
        attempt++;
        continue;
      }
      res.failed++;
      res.warnings.push(msg);
      break;
    }
  }
  if (droppedCols.size > 0) {
    res.warnings.unshift(`skipped unknown columns: ${[...droppedCols].join(", ")}`);
  }
  return res;
}

export const importBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RestoreInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { payload, groups } = data;

    let targetTables: string[];
    if (!groups || groups.length === 0) {
      targetTables = [...BACKUP_TABLES];
    } else {
      const set = new Set<string>();
      for (const g of groups) {
        const ts = RESTORE_GROUPS[g];
        if (ts) ts.forEach((t) => set.add(t));
      }
      targetTables = [...set];
    }

    const missing: string[] = [];
    const results: TableResult[] = [];
    for (const t of targetTables) {
      if (!(t in payload.tables)) {
        missing.push(t);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const r = await restoreTable(t, payload.tables[t]);
      results.push(r);
    }
    return { results, missing };
  });

// ---------- Bootstrap super_admin ----------
export const initSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing, error: e1 } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .limit(1);
    if (e1) throw new Error(e1.message);
    if (existing && existing.length > 0) {
      throw new Error("Super admin already exists");
    }
    const { error: e2 } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "super_admin" });
    if (e2) throw new Error(e2.message);
    return { ok: true } as any;
  });

export const hasSuperAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin")
    .limit(1);
  if (error) throw new Error(error.message);
  return { hasSuperAdmin: (data?.length ?? 0) > 0 };
});