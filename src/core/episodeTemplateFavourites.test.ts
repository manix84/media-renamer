import { describe, expect, it } from 'vitest';
import { automaticEpisodeTemplateName, episodeTemplateFavouriteName } from './episodeTemplateFavourites';

describe('episode template favourites', () => {
  it('generates a concise name from fields in template order', () => {
    expect(automaticEpisodeTemplateName('{{show.name}} ({{show.year}}) - {{episode.range}} - {{title}} [{{technical}}]')).toBe('Show · Year · S01E01 · Title · Technical');
    expect(automaticEpisodeTemplateName('{{episode.range}} {{show.name}}')).toBe('S01E01 · Show');
    expect(automaticEpisodeTemplateName('{{movie.name}} ({{movie.year}}) [{{technical}}] {tmdb-{{movie.tmdbId}}}')).toBe('Movie · Year · Technical · TMDB');
  });

  it('uses custom names while keeping blank names automatic', () => {
    expect(episodeTemplateFavouriteName({ name: '', template: '{{show.name}} - {{episode.range}}' })).toBe('Show · S01E01');
    expect(episodeTemplateFavouriteName({ name: '  Plex compact  ', template: '{{show.name}}' })).toBe('Plex compact');
    expect(automaticEpisodeTemplateName('literal filename')).toBe('Custom episode template');
  });
});
