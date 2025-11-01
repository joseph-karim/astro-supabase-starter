import type { APIRoute } from "astro";
import { supabase } from "../utils/database";

export const GET: APIRoute = async () => {
  let claimUrls = "";

  if (supabase) {
    const { data } = await supabase
      .from("claims")
      .select("slug, updated_at")
      .eq("published", true);

    if (data) {
      claimUrls = data
        .map(
          (r) => `
  <url>
    <loc>https://becometheanswer.ai/claim/${r.slug}</loc>
    <lastmod>${new Date(r.updated_at).toISOString()}</lastmod>
  </url>`
        )
        .join("");
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://becometheanswer.ai/</loc>
  </url>
  <url>
    <loc>https://becometheanswer.ai/wizard</loc>
  </url>
  <url>
    <loc>https://becometheanswer.ai/guarantees</loc>
  </url>${claimUrls}
</urlset>`;

  return new Response(xml, {
    headers: { "content-type": "application/xml" }
  });
};
