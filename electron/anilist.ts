const API_ROOT = 'https://graphql.anilist.co';

type AniListMedia = {
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
  synonyms?: string[];
};

function punctuationTolerantQuery(query: string): string {
  return query.replace(/\b(im|dont|cant|wont|isnt|arent|wasnt|werent|hasnt|havent|hadnt|doesnt|didnt|wouldnt|shouldnt|couldnt)\b/gi, (word) => {
    const split = word === 'im' ? 1 : word.length - 1;
    return `${word.slice(0, split)} ${word.slice(split)}`;
  });
}

export class AniListClient {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async searchAnimeTitles(query: string): Promise<string[]> {
    const response = await this.fetcher(API_ROOT, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'query ($search: String) { Media(search: $search, type: ANIME) { title { romaji english native } synonyms } }',
        variables: { search: punctuationTolerantQuery(query) },
      }),
    });
    if (!response.ok) return [];
    const body = await response.json() as { data?: { Media?: AniListMedia | null } };
    const media = body.data?.Media;
    if (!media) return [];
    return [...new Set([media.title?.english, media.title?.romaji, media.title?.native, ...(media.synonyms ?? [])].filter((title): title is string => Boolean(title?.trim())).map((title) => title.trim()))];
  }
}
