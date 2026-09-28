import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";

const SUPABASE_URL = "https://hotfvqqzahakumwadtiy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_m_gos4Hv-QH8zWxiC6PjkQ_stnTrzRg";
const AUTHORIZATION_ID_PATTERN = /^[a-zA-Z0-9_.:-]{10,1024}$/;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function authorizationIdFromLocation() {
  const authorizationId = new URL(location.href).searchParams.get("authorization_id");
  return authorizationId && AUTHORIZATION_ID_PATTERN.test(authorizationId)
    ? authorizationId
    : null;
}

export function appUrl(path, authorizationId) {
  const url = new URL(path, location.origin);
  url.searchParams.set("authorization_id", authorizationId);
  return url.toString();
}
