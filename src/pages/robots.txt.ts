import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  const robotsTxt = `User-agent: *
Allow: /
Sitemap: https://becometheanswer.ai/sitemap.xml`;

  return new Response(robotsTxt, {
    headers: { "content-type": "text/plain" }
  });
};
