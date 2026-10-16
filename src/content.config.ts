import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const posts = defineCollection({
  loader: glob({
    base: "./articles/posts",
    pattern: "*/index.md",
    generateId: ({ entry }) => {
      const slug = entry.split("/")[0];
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error(`Invalid article folder: ${slug}. Use lowercase English, numbers and hyphens.`);
      }
      return slug;
    },
  }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().default(""),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(true),
    category: z.string().default(""),
    tags: z.array(z.string()).default([]),
  }),
});

const pages = defineCollection({
  loader: glob({ base: "./articles/spec", pattern: "{about,friends}.md" }),
  schema: z.object({ title: z.string().min(1), description: z.string().default("") }),
});

export const collections = { posts, pages };
