// Public build-time configuration only. Authentication itself uses the shared
// FastAPI session; do not create a second browser token/localStorage session.
export function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  if (publishableKey && !publishableKey.startsWith("sb_publishable_")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key.",
    );
  }
  if (url) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.origin !== url.replace(/\/$/, "")
    ) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS origin.");
    }
  }
  return { url: url.replace(/\/$/, ""), publishableKey };
}
