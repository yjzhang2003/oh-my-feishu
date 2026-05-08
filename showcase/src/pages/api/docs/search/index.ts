import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { docHref, searchableText, sortDocs } from '@/data/docs';

export const prerender = false;

type SearchResult = {
  title: string;
  href: string;
  excerpt: string;
};

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return 8;
  return Math.min(Math.max(parsed, 1), 20);
}

function excerptFor(text: string, query: string): string {
  const cleanText = text
    .replace(/^---[\s\S]*?---/m, ' ')
    .replace(/[`*_#[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedText = cleanText.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const index = normalizedText.indexOf(normalizedQuery);
  if (index === -1) return `${cleanText.slice(0, 96)}${cleanText.length > 96 ? '...' : ''}`;
  const start = Math.max(index - 32, 0);
  const end = Math.min(index + query.length + 72, cleanText.length);
  return `${start > 0 ? '...' : ''}${cleanText.slice(start, end)}${end < cleanText.length ? '...' : ''}`;
}

export const GET: APIRoute = async ({ url }) => {
  const query = (url.searchParams.get('q') || '').trim();
  const limit = parseLimit(url.searchParams.get('limit'));

  if (!query) {
    return Response.json({ query, results: [] });
  }

  const docs = sortDocs(await getCollection('docs'));
  const normalizedQuery = query.toLowerCase();
  const results: SearchResult[] = docs
    .map((doc) => {
      const text = searchableText(doc);
      const normalizedText = text.toLowerCase();
      const titleHit = doc.data.title.toLowerCase().includes(normalizedQuery);
      const summaryHit = doc.data.summary.toLowerCase().includes(normalizedQuery);
      const bodyHit = normalizedText.includes(normalizedQuery);
      if (!titleHit && !summaryHit && !bodyHit) return null;

      return {
        title: doc.data.title,
        href: docHref(doc.id),
        excerpt: excerptFor(summaryHit ? doc.data.summary : text, query),
        score: titleHit ? 3 : summaryHit ? 2 : 1,
      };
    })
    .filter((item): item is SearchResult & { score: number } => item !== null)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'zh-CN'))
    .slice(0, limit)
    .map(({ score: _score, ...item }) => item);

  return Response.json({ query, results });
};
