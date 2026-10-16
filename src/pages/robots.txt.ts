import { site } from "../site.mjs";

export function GET() {
  const preview = process.env.CF_PAGES_BRANCH && process.env.CF_PAGES_BRANCH !== "main";
  return new Response(preview ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap-index.xml\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
