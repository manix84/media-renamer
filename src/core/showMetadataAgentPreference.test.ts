import { describe, expect, it } from 'vitest';
import { DEFAULT_SHOW_METADATA_AGENT, resolveShowMetadataAgentPreference, SHOW_METADATA_AGENT_DEFAULT_VERSION } from './showMetadataAgentPreference';

describe('show metadata agent preference', () => {
  it('uses TVDB aired order for a new profile', () => {
    expect(resolveShowMetadataAgentPreference({})).toBe('tvdb-aired');
    expect(DEFAULT_SHOW_METADATA_AGENT).toBe('tvdb-aired');
  });

  it('migrates the old TMDB default so We Bare Bears Christmas Parties stays at Plex S02E22 instead of TMDB S02E23', () => {
    expect(resolveShowMetadataAgentPreference({ showMetadataAgent: 'tmdb-aired', showMetadataAgentDefaultVersion: 3 })).toBe('tvdb-aired');
  });

  it('does not allow a persisted TMDB choice to override canonical TVDB ordering', () => {
    expect(resolveShowMetadataAgentPreference({ showMetadataAgent: 'tmdb-aired', showMetadataAgentDefaultVersion: SHOW_METADATA_AGENT_DEFAULT_VERSION })).toBe('tvdb-aired');
  });
});
