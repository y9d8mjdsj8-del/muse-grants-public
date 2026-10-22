/** Accept a project URL or the Data API base URL copied from the dashboard. */
export function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Invalid Supabase project URL");
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid Supabase project URL");
  }
  // Preserve custom proxy prefixes; remove only a terminal Data API suffix.
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  return url.toString().replace(/\/$/, "");
}
