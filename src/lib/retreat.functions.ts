import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** 只允许 admin 或 super_admin 调用 */
async function assertAdminOrAbove(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin"])
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: admin only");
}

const personSchema = z.object({
  chinese_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().max(80).optional().nullable(),
  first_name: z.string().trim().max(80).optional().nullable(),
  gender: z.string().trim().max(4).optional().nullable(),
  cell: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(120).optional().nullable(),
  program: z.string().trim().max(8).optional().nullable(),
  topic: z.string().trim().max(8).optional().nullable(),
  bed: z.string().trim().max(20).optional().nullable(),
  user_notes: z.string().trim().max(500).optional().nullable(),
});

const submitSchema = z.object({
  church: z.string().trim().max(10).optional().nullable(),
  can_pickup: z.number().int().min(0).max(50).optional().nullable(),
  need_pickup: z.number().int().min(0).max(50).optional().nullable(),
  main: personSchema,
  companions: z.array(personSchema).max(6).default([]),
});

const phoneSchema = z.string().trim().min(3).max(40);

function normalize(p: string) {
  return p.replace(/\D/g, "");
}

/** Split a confirmation_no like "0725-AAA-002" → { mmdd, code, seq }. */
function parseConfNo(c: string | null) {
  if (!c) return null;
  const parts = c.split("-");
  if (parts.length !== 3) return null;
  const [mmdd, code, seqStr] = parts;
  const seq = parseInt(seqStr, 10);
  if (!mmdd || !code || isNaN(seq)) return null;
  return { mmdd, code, seq };
}

/** Stable group key. Family groups share letter codes (AAA, BBB…);
 *  a solo "000" registration is its own group (keyed by full confNo). */
function groupKeyOf(c: string | null): string | null {
  const p = parseConfNo(c);
  if (!p) return c;
  if (p.code === "000") return c;
  return `${p.mmdd}-${p.code}`;
}

/** Fetch every row in `refId`'s group. */
async function fetchGroupRows(refId: string) {
  const { data: ref, error } = await supabaseAdmin
    .from("retreat_registrations")
    .select("*")
    .eq("id", refId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ref) throw new Error("记录不存在");
  const parsed = parseConfNo(ref.confirmation_no);
  if (!parsed || parsed.code === "000") return { ref, rows: [ref] };
  const prefix = `${parsed.mmdd}-${parsed.code}-`;
  const { data: siblings, error: e2 } = await supabaseAdmin
    .from("retreat_registrations")
    .select("*")
    .like("confirmation_no", `${prefix}%`)
    .order("confirmation_no", { ascending: true });
  if (e2) throw new Error(e2.message);
  return { ref, rows: siblings ?? [] };
}

async function verifyGroupOwnership(refId: string, phone: string) {
  const { rows } = await fetchGroupRows(refId);
  const target = normalize(phone);
  if (!target) throw new Error("电话号码无效");
  const ok = rows.some((r) => normalize(r.cell ?? "") === target);
  if (!ok) throw new Error("电话号码不匹配，无法修改此登记单");
  return rows;
}

/** Public lookup by phone — returns retreat registrations whose `cell`
 * matches the supplied phone (exact, or last-7-digit fuzzy match). */
export const lookupRetreatByPhone = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data }) => {
    const phone = data.phone.trim();
    const norm = normalize(phone);
    if (norm.length < 3) throw new Error("电话号码无效");
    // 1. exact match first
    const exact = await supabaseAdmin
      .from("retreat_registrations")
      .select("*")
      .eq("cell", phone)
      .order("entry_no", { ascending: true });
    if (exact.error) throw new Error(exact.error.message);
    if (exact.data && exact.data.length > 0) return { rows: exact.data };
    // 2. fuzzy by last 7 digits
    const tail = norm.slice(-7);
    const fuzzy = await supabaseAdmin
      .from("retreat_registrations")
      .select("*")
      .ilike("cell", `%${tail}%`)
      .order("entry_no", { ascending: true });
    if (fuzzy.error) throw new Error(fuzzy.error.message);
    return { rows: fuzzy.data ?? [] };
  });

const editPatchSchema = z.object({
  chinese_name: z.string().trim().min(1).max(80).optional(),
  last_name: z.string().trim().max(80).nullable().optional(),
  first_name: z.string().trim().max(80).nullable().optional(),
  gender: z.string().trim().max(4).nullable().optional(),
  cell: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().max(120).nullable().optional(),
  program: z.string().trim().max(8).nullable().optional(),
  topic: z.string().trim().max(8).nullable().optional(),
  bed: z.string().trim().max(20).nullable().optional(),
  can_pickup: z.number().int().min(0).max(50).nullable().optional(),
  need_pickup: z.number().int().min(0).max(50).nullable().optional(),
  user_notes: z.string().trim().max(500).nullable().optional(),
  church: z.string().trim().max(10).nullable().optional(),
});

// (legacy verifyOwnership replaced by group-aware verifyGroupOwnership above)

export const updateRetreatByPhone = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      phone: phoneSchema,
      patch: editPatchSchema,
    }).parse(d)
  )
  .handler(async ({ data }) => {
    // Group-aware: phone may match any member of the same registration form.
    await verifyGroupOwnership(data.id, data.phone);
    const { error } = await supabaseAdmin
      .from("retreat_registrations")
      .update(data.patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteRetreatByPhone = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), phone: phoneSchema }).parse(d)
  )
  .handler(async ({ data }) => {
    const groupRows = await verifyGroupOwnership(data.id, data.phone);
    const { error } = await supabaseAdmin
      .from("retreat_registrations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true, remaining: Math.max(0, groupRows.length - 1) };
  });

function mmddInPacific(d = new Date()): string {
  const s = d.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit",
    day: "2-digit",
  }); // "05/25"
  return s.replace("/", "");
}

// Group codes per day jump AAA -> BBB -> CCC ... -> ZZZ
function nextLetters(prev: string | null): string {
  if (!prev) return "AAA";
  // Find the leading char and advance by one
  const head = prev[0];
  if (head >= "Z") throw new Error("Letter group exhausted for the day");
  const nxt = String.fromCharCode(head.charCodeAt(0) + 1);
  return nxt.repeat(3);
}

export const submitRetreatRegistration = createServerFn({ method: "POST" })
  .inputValidator((d) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const mmdd = mmddInPacific();
    const isGroup = data.companions.length > 0;
    const people = [data.main, ...data.companions];

    // Fetch existing confirmation numbers for today
    const { data: existing, error: qErr } = await supabaseAdmin
      .from("retreat_registrations")
      .select("confirmation_no")
      .like("confirmation_no", `${mmdd}-%`);
    if (qErr) throw new Error(qErr.message);

    const nums = (existing ?? [])
      .map((r) => r.confirmation_no as string | null)
      .filter((s): s is string => !!s);

    let groupCode: string;
    if (!isGroup) {
      groupCode = "000";
    } else {
      // Find max existing letter group != "000"
      // Find the latest triple-letter code used today (only consider XXX-style triplets)
      let maxLetters: string | null = null;
      for (const n of nums) {
        const parts = n.split("-"); // [mmdd, code, seq]
        const code = parts[1];
        if (!code || code === "000") continue;
        if (!/^([A-Z])\1\1$/.test(code)) continue;
        if (maxLetters === null || code > maxLetters) maxLetters = code;
      }
      groupCode = nextLetters(maxLetters);
    }

    // Find next sequence within this group
    const prefix = `${mmdd}-${groupCode}-`;
    let maxSeq = 0;
    for (const n of nums) {
      if (n.startsWith(prefix)) {
        const seq = parseInt(n.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }

    const inserts = people.map((p, idx) => {
      const seq = String(maxSeq + idx + 1).padStart(3, "0");
      const need = data.need_pickup ?? 0;
      return {
        confirmation_no: `${prefix}${seq}`,
        church: data.church ?? null,
        chinese_name: p.chinese_name,
        last_name: p.last_name ?? null,
        first_name: p.first_name ?? null,
        gender: p.gender ?? null,
        cell: p.cell ?? null,
        email: p.email ?? null,
        program: p.program ?? null,
        topic: p.topic ?? null,
        bed: p.bed ?? null,
        // Pickup info applies to whole group; store on first record only
        can_pickup: idx === 0 ? data.can_pickup ?? null : null,
        need_pickup: idx === 0 ? need || null : null,
        bus: idx === 0 ? (need > 0 ? "Y" : "N") : null,
        user_notes: p.user_notes ?? null,
      };
    });

    const { error } = await supabaseAdmin.from("retreat_registrations").insert(inserts);
    if (error) throw new Error(error.message);

    return {
      success: true,
      confirmation_numbers: inserts.map((i) => i.confirmation_no),
    };
  });

// ─────────────────────────────────────────────────────────────
// Group lookup / add-member endpoints (used by phone-edit + admin)
// ─────────────────────────────────────────────────────────────

/** Lookup by phone, expanding each match to its full registration form. */
export const lookupRetreatGroupByPhone = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data }) => {
    const phone = data.phone.trim();
    const norm = normalize(phone);
    if (norm.length < 3) throw new Error("电话号码无效");

    let { data: matches, error } = await supabaseAdmin
      .from("retreat_registrations")
      .select("*")
      .eq("cell", phone);
    if (error) throw new Error(error.message);
    if (!matches || matches.length === 0) {
      const tail = norm.slice(-7);
      const fuzzy = await supabaseAdmin
        .from("retreat_registrations")
        .select("*")
        .ilike("cell", `%${tail}%`);
      if (fuzzy.error) throw new Error(fuzzy.error.message);
      matches = fuzzy.data ?? [];
    }
    if (matches.length === 0) return { groups: [] };

    const seen = new Map<string, any[]>();
    for (const m of matches) {
      const key = groupKeyOf(m.confirmation_no) ?? m.id;
      if (seen.has(key)) continue;
      const { rows } = await fetchGroupRows(m.id);
      seen.set(key, rows);
    }
    return {
      groups: Array.from(seen.entries()).map(([key, members]) => ({ key, members })),
    };
  });

/** Admin-trusted: fetch full group given any member's id. */
export const fetchRetreatGroupById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrAbove(context.userId);
    const { rows } = await fetchGroupRows(data.id);
    return { members: rows };
  });

async function nextLetterCodeForDay(mmdd: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("retreat_registrations")
    .select("confirmation_no")
    .like("confirmation_no", `${mmdd}-%`);
  if (error) throw new Error(error.message);
  let maxLetters: string | null = null;
  for (const r of data ?? []) {
    const p = parseConfNo(r.confirmation_no);
    if (!p || p.code === "000") continue;
    if (!/^([A-Z])\1\1$/.test(p.code)) continue;
    if (maxLetters === null || p.code > maxLetters) maxLetters = p.code;
  }
  return nextLetters(maxLetters);
}

async function insertGroupMember(
  refId: string,
  person: z.infer<typeof personSchema>,
) {
  const { ref, rows } = await fetchGroupRows(refId);
  const refParsed = parseConfNo(ref.confirmation_no);

  let prefix: string;
  if (!refParsed) {
    const mmdd = mmddInPacific();
    prefix = `${mmdd}-${await nextLetterCodeForDay(mmdd)}-`;
  } else if (refParsed.code === "000") {
    // Promote solo → fresh letter group, rename existing row to seq 001
    const newCode = await nextLetterCodeForDay(refParsed.mmdd);
    const promoted = `${refParsed.mmdd}-${newCode}-001`;
    const { error: upErr } = await supabaseAdmin
      .from("retreat_registrations")
      .update({ confirmation_no: promoted })
      .eq("id", ref.id);
    if (upErr) throw new Error(upErr.message);
    prefix = `${refParsed.mmdd}-${newCode}-`;
  } else {
    prefix = `${refParsed.mmdd}-${refParsed.code}-`;
  }

  // Re-query within prefix to get latest seq (handles promotion case)
  const { data: latest, error: qErr } = await supabaseAdmin
    .from("retreat_registrations")
    .select("confirmation_no")
    .like("confirmation_no", `${prefix}%`);
  if (qErr) throw new Error(qErr.message);
  let maxSeq = 0;
  for (const r of latest ?? []) {
    const p = parseConfNo(r.confirmation_no);
    if (p && p.seq > maxSeq) maxSeq = p.seq;
  }
  const confNo = `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;

  const { error } = await supabaseAdmin.from("retreat_registrations").insert({
    confirmation_no: confNo,
    church: ref.church ?? null,
    chinese_name: person.chinese_name,
    last_name: person.last_name ?? null,
    first_name: person.first_name ?? null,
    gender: person.gender ?? null,
    cell: person.cell ?? null,
    email: person.email ?? null,
    program: person.program ?? null,
    topic: person.topic ?? null,
    bed: person.bed ?? null,
    user_notes: person.user_notes ?? null,
  });
  if (error) throw new Error(error.message);
  // Suppress unused-var lint (rows is used implicitly for prefix decision)
  void rows;
  return confNo;
}

/** Public: phone-verified add member. */
export const addRetreatGroupMember = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      groupRefId: z.string().uuid(),
      phone: phoneSchema,
      person: personSchema,
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyGroupOwnership(data.groupRefId, data.phone);
    const confNo = await insertGroupMember(data.groupRefId, data.person);
    return { success: true, confirmation_no: confNo };
  });

/** Admin-trusted add member (no phone check). */
export const adminAddRetreatGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      groupRefId: z.string().uuid(),
      person: personSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrAbove(context.userId);
    const confNo = await insertGroupMember(data.groupRefId, data.person);
    return { success: true, confirmation_no: confNo };
  });