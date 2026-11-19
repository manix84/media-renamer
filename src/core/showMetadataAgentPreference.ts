import type { ShowMetadataAgent } from './types';

export const SHOW_METADATA_AGENT_DEFAULT_VERSION = 3;
export const DEFAULT_SHOW_METADATA_AGENT: ShowMetadataAgent = 'tmdb-aired';

export function resolveShowMetadataAgentPreference(saved: {
  showMetadataAgent?: ShowMetadataAgent;
  showMetadataAgentDefaultVersion?: number;
}): ShowMetadataAgent {
  if (saved.showMetadataAgentDefaultVersion === SHOW_METADATA_AGENT_DEFAULT_VERSION && saved.showMetadataAgent) {
    return saved.showMetadataAgent;
  }
  return DEFAULT_SHOW_METADATA_AGENT;
}
