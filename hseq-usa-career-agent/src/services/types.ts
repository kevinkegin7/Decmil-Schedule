import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/** Any Supabase client acting as a signed-in user (server, browser or test). */
export type Db = SupabaseClient<Database>;
