import { getCollection } from "astro:content";

export async function publishedPosts() {
  return (await getCollection("posts", ({ data }) => !data.draft && data.published.getTime() <= Date.now()))
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime() || a.id.localeCompare(b.id));
}

export function dateText(date: Date) {
  return date.toISOString().slice(0, 10);
}
