import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BriefSchema = z.object({
  project_name: z.string().max(200).default(""),
  idea: z.string().max(4000).default(""),
  audience: z.string().max(2000).default(""),
  duration: z.string().max(200).default(""),
  budget: z.string().max(200).default(""),
  country: z.string().max(200).default(""),
  language: z.string().max(5).default("ar"),
  notes: z.string().max(4000).default(""),
});

export type BriefInput = z.infer<typeof BriefSchema>;

export const getBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("briefs")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const saveBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BriefSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("briefs")
      .upsert({ ...data, user_id: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ role: z.enum(["user", "assistant"]), content: z.unknown() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("chat_messages").insert({
      user_id: context.userId,
      role: data.role,
      content: data.content as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("chat_messages")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
