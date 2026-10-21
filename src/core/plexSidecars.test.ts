import { describe, expect, it } from 'vitest';
import { episodeNfo, movieNfo, plexArtworkAssets, plexMovieArtworkAssets, plexSeasonArtworkAsset, plexShowDirectories, showNfo } from './plexSidecars';

describe('Plex NFO and artwork sidecars', () => {
  it('escapes movie metadata and emits stable provider IDs', () => {
    const output = movieNfo({ id: '12', imdbId: 'tt123', name: 'A & B', year: 2026, overview: '<plot>' });
    expect(output).toContain('<title>A &amp; B</title>');
    expect(output).toContain('<uniqueid type="tmdb" default="true">12</uniqueid>');
    expect(output).toContain('<uniqueid type="imdb">tt123</uniqueid>');
  });

  it('supports Plex multi-episode NFO files', () => {
    const output = episodeNfo([{ id: '1', season: 1, number: 1, title: 'One' }, { id: '2', season: 1, number: 2, title: 'Two' }]);
    expect(output.match(/<episodedetails>/g)).toHaveLength(2);
    expect(output).toContain('<episode>2</episode>');
  });

  it('emits a show NFO and every available Plex artwork class', () => {
    expect(showNfo({ id: '7', tvdbId: '8', name: 'Show', overview: '', seasons: [] })).toContain('<uniqueid type="tvdb" default="true">8</uniqueid>');
    expect(plexArtworkAssets('/TV/Show', { posterUrl: 'https://image.tmdb.org/a.jpg', backgroundUrl: 'https://image.tmdb.org/b.jpeg', logoUrl: 'https://image.tmdb.org/c.png', squareUrl: 'https://image.tmdb.org/d.jpg', bannerUrl: 'https://image.tmdb.org/e.jpg' }).map((asset) => asset.targetPath)).toEqual([
      '/TV/Show/poster.jpg', '/TV/Show/background.jpg', '/TV/Show/logo.png', '/TV/Show/square.jpg', '/TV/Show/banner.jpg',
    ]);
    expect(plexSeasonArtworkAsset('/TV/Show/Season 01', 1, 'https://image.tmdb.org/season.jpg').targetPath).toBe('/TV/Show/Season 01/Season01.jpg');
    expect(plexSeasonArtworkAsset('/TV/Show/Specials', 0, 'https://image.tmdb.org/specials.jpg').targetPath).toBe('/TV/Show/Specials/season-specials-poster.jpg');
    expect(plexShowDirectories('/TV/Show/Season 01/Disc 1')).toEqual({ showRoot: '/TV/Show', seasonDirectory: '/TV/Show/Season 01' });
    expect(plexShowDirectories('/TV/Show')).toEqual({ showRoot: '/TV/Show', seasonDirectory: '/TV/Show' });
    expect(plexMovieArtworkAssets('/Movies/Avatar (2009).mkv', { posterUrl: 'https://image.tmdb.org/a.jpg', backgroundUrl: 'https://image.tmdb.org/b.jpg', logoUrl: 'https://image.tmdb.org/c.png', squareUrl: 'https://image.tmdb.org/d.png' }, false).map((asset) => asset.targetPath)).toEqual([
      '/Movies/Avatar (2009).jpg', '/Movies/Avatar (2009)-fanart.jpg', '/Movies/Avatar (2009)-clearlogo.png', '/Movies/Avatar (2009)-squareArt.png',
    ]);
  });
});
