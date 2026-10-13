import { describe, expect, it, vi } from 'vitest';
import { AniListClient } from './anilist.js';

describe('AniList adapter', () => {
  it('resolves punctuation-stripped English anime titles to provider aliases', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { Media: {
      title: { english: "Now That I Can Control Reality With A Mouse Cursor, I'm Gonna Click Away On The Girls!", romaji: 'Mouse Cursor de Genjitsu wo Sousa Dekiru You ni Natta node' },
      synonyms: ['Click Me All Over'],
    } } }), { status: 200 }));
    const titles = await new AniListClient(fetcher).searchAnimeTitles('Now That I Can Control Reality With A Mouse Cursor Im Gonna Click Away On The Girls');
    expect(titles).toContain('Mouse Cursor de Genjitsu wo Sousa Dekiru You ni Natta node');
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string).variables.search).toContain('I m Gonna');
  });
});
