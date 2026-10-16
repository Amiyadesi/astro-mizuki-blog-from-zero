import config from "../site.config.mjs";

const url = new URL(process.env.SITE_URL || config.url || process.env.CF_PAGES_URL || "http://localhost:4321");
if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("SITE_URL must be an http(s) origin, such as https://your-blog.pages.dev");
}

export const site = { ...config, url: url.origin };
