import type { CollectionEntry } from 'astro:content';

export type DocPage = CollectionEntry<'docs'>;

export type DocNavItem = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  tags: string[];
};

export function toDocNavItem(doc: DocPage): DocNavItem {
  return {
    slug: doc.id,
    title: doc.data.title,
    eyebrow: doc.data.eyebrow,
    summary: doc.data.summary,
    tags: doc.data.tags,
  };
}

export function sortDocs<T extends { data: { order: number } }>(docs: T[]): T[] {
  return [...docs].sort((a, b) => a.data.order - b.data.order);
}

export function docHref(slug: string): string {
  return `/docs/${slug}/`;
}

export function searchableText(doc: DocPage): string {
  return [
    doc.data.title,
    doc.data.eyebrow,
    doc.data.summary,
    doc.data.tags.join(' '),
    doc.body,
  ].join(' ');
}
