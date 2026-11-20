import type { ShowMetadataAgent } from './types';

export const SHOW_METADATA_AGENT_DEFAULT_VERSION = 4;
export const DEFAULT_SHOW_METADATA_AGENT: ShowMetadataAgent = 'tvdb-aired';

export function resolveShowMetadataAgentPreference(saved: {
  showMetadataAgent?: ShowMetadataAgent;
  showMetadataAgentDefaultVersion?: number;
}): ShowMetadataAgent {
  void saved;
  return DEFAULT_SHOW_METADATA_AGENT;
}
