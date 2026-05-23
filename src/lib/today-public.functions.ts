import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SF_TZ = "America/Los_Angeles";

function getTzParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

function getOffsetMs(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(v.year),
    Number(v.month) - 1,
    Number(v.day),
    Number(v.hour),
    Number(v.minute),
    Number(v.second),
  );
  return asUtc - date.getTime();
}

function zonedMidnightToUtc(y: number, m: number, d: number, tz: string) {
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  return new Date(guess.getTime() - getOffsetMs(guess, tz));
}

export const getTodayPublic = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(8).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env.PUBLIC_VIEW_TOKEN;
    if (!expected) throw new Error("Server not configured");
    if (data.token !== expected) throw new Error("Unauthorized");

    const { year, month, day } = getTzParts(new Date(), SF_TZ);
    const start = zonedMidnightToUtc(year, month, day, SF_TZ).toISOString();
    const end = zonedMidnightToUtc(year, month, day + 1, SF_TZ).toISOString();

    const { data: regs, error } = await supabaseAdmin
      .from("registrations")
      .select(
        "id,name,name_en,faith,faith_years,faith_other,referrer_type,invited_by,referrer_other,notes,created_at",
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { regs: regs ?? [] };
  });
