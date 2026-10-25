import { describe, expect, it } from 'vitest';
import { normalizeExtensionManifest } from './extensions';
import { prepareMetadataOperation } from './extensionMetadataAdapters';

const manifest = normalizeExtensionManifest({
  apiVersion: 1,
  id: 'example.anilist',
  name: 'AniList example',
  version: '1.0.0',
  description: 'Example provider adapter.',
  settings: [],
  match: { mediaKinds: ['show', 'movie'] },
  capabilities: [{ id: 'network.metadata', reason: 'Search AniList.', origins: ['https://graphql.anilist.co'] }],
  metadataAdapters: [{
    id: 'anilist',
    label: 'AniList',
    capability: 'network.metadata',
    transport: 'graphql-json',
    origin: 'https://graphql.anilist.co',
    endpointPath: '/',
    operations: [{
      id: 'anime.search',
      label: 'Search anime',
      kind: 'search',
      mediaKinds: ['show', 'movie'],
      query: 'query ($query: String) { Media(search: $query, type: ANIME) { id } }',
      inputs: [{ name: 'query', type: 'string', required: true, maximumLength: 200 }],
    }],
  }],
}, 'installed');

describe('extension metadata adapter operations', () => {
  it('builds a bounded host-owned GraphQL JSON request', () => {
    expect(prepareMetadataOperation(manifest, 'anilist', 'anime.search', { query: 'Sailor Moon' })).toEqual(expect.objectContaining({
      extensionId: 'example.anilist',
      capability: 'network.metadata',
      origin: 'https://graphql.anilist.co',
      request: {
        url: 'https://graphql.anilist.co/',
        method: 'POST',
        body: expect.objectContaining({ variables: { query: 'Sailor Moon' } }),
      },
    }));
  });

  it('rejects missing, unknown, incorrectly typed, and oversized inputs', () => {
    expect(() => prepareMetadataOperation(manifest, 'anilist', 'anime.search', {})).toThrow('is required');
    expect(() => prepareMetadataOperation(manifest, 'anilist', 'anime.search', { query: 'x', extra: 'no' })).toThrow('unknown input');
    expect(() => prepareMetadataOperation(manifest, 'anilist', 'anime.search', { query: 42 })).toThrow('is invalid');
    expect(() => prepareMetadataOperation(manifest, 'anilist', 'anime.search', { query: 'x'.repeat(201) })).toThrow('is invalid');
  });
});
