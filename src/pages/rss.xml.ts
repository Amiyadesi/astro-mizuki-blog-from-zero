import rss from "@astrojs/rss";
import { publishedPosts } from "../posts";
import { site } from "../site.mjs";

export async function GET() {
  return rss({
    title: site.title, description: site.description, site: site.url,
    items: (await publishedPosts()).map(post => ({
      title: post.data.title, description: post.data.description,
      pubDate: post.data.published, link: `/posts/${post.id}/`,
    })),
  });
}
