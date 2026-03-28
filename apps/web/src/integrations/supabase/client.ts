import { createClient } from "@supabase/supabase-js";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import type { Database } from "./types";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

export const supabase = createClient<Database>(
  webRuntimeConfig.supabaseUrl,
  webRuntimeConfig.supabaseAnonKey
);
