import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

async function verifyOwnership(id: string, phone: string) {
  const { data: row, error } = await supabaseAdmin
    .from("retreat_registrations")
    .select("cell")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("记录不存在");
  const a = normalize(row.cell ?? "");
  const b = normalize(phone);
  if (!a || !b || a !== b) throw new Error("电话号码不匹配，无法修改此记录");
}

export const updateRetreatByPhone = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      phone: phoneSchema,
      patch: editPatchSchema,
    }).parse(d)
  )
  .handler(async ({ data }) => {
    await verifyOwnership(data.id, data.phone);
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
    await verifyOwnership(data.id, data.phone);
    const { error } = await supabaseAdmin
      .from("retreat_registrations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
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