import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Server-only client using the service-role key. Tables have RLS on with no policies, so nothing is reachable from a browser. */
export function db(): SupabaseClient {
  if (!client) {
    // Accept the URL with or without the "/rest/v1/" suffix Supabase shows on some screens.
    const url = process.env.SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/** Throw a readable error if a Supabase call failed. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Database error: ${res.error.message}`);
  return res.data as T;
}

export async function audit(event: string, detail = "", candidateId: string | null = null) {
  await db().from("audit").insert({ event, detail, candidate_id: candidateId });
}
