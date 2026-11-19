import { describe, expect, it } from 'vitest';
import { DEFAULT_SHOW_METADATA_AGENT, resolveShowMetadataAgentPreference, SHOW_METADATA_AGENT_DEFAULT_VERSION } from './showMetadataAgentPreference';

describe('show metadata agent preference', () => {
  it('uses TMDB for a new profile', () => {
    expect(resolveShowMetadataAgentPreference({})).toBe('tmdb-aired');
    expect(DEFAULT_SHOW_METADATA_AGENT).toBe('tmdb-aired');
  });

  it('migrates the previous TVDB default to TMDB', () => {
    expect(resolveShowMetadataAgentPreference({ showMetadataAgent: 'tvdb-aired', showMetadataAgentDefaultVersion: 2 })).toBe('tmdb-aired');
  });

  it('preserves an explicit choice made under the current default version', () => {
    expect(resolveShowMetadataAgentPreference({ showMetadataAgent: 'tvdb-aired', showMetadataAgentDefaultVersion: SHOW_METADATA_AGENT_DEFAULT_VERSION })).toBe('tvdb-aired');
  });
});
