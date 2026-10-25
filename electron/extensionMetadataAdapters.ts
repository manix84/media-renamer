import type { InstalledExtensionManifest } from './extensions.js';
import type { ExtensionJsonRequest } from './extensionNetwork.js';

export interface PreparedMetadataOperation {
  extensionId: string;
  adapterId: string;
  operationId: string;
  capability: 'network.metadata';
  origin: string;
  request: ExtensionJsonRequest;
}

export function prepareMetadataOperation(
  extension: InstalledExtensionManifest,
  adapterId: string,
  operationId: string,
  suppliedInputs: Record<string, unknown>,
): PreparedMetadataOperation {
  const adapter = extension.metadataAdapters?.find((candidate) => candidate.id === adapterId);
  if (!adapter) throw new Error('Extension metadata adapter was not found.');
  const operation = adapter.operations.find((candidate) => candidate.id === operationId);
  if (!operation) throw new Error('Extension metadata operation was not found.');
  const declaredNames = new Set(operation.inputs.map((input) => input.name));
  if (Object.keys(suppliedInputs).some((name) => !declaredNames.has(name))) throw new Error('Extension metadata operation received an unknown input.');
  const variables: Record<string, string> = {};
  for (const input of operation.inputs) {
    const value = suppliedInputs[input.name];
    if (value === undefined || value === null || value === '') {
      if (input.required) throw new Error(`Extension metadata input ${input.name} is required.`);
      continue;
    }
    if (typeof value !== 'string' || value.length > input.maximumLength) throw new Error(`Extension metadata input ${input.name} is invalid.`);
    variables[input.name] = value;
  }
  return {
    extensionId: extension.id,
    adapterId,
    operationId,
    capability: adapter.capability,
    origin: adapter.origin,
    request: {
      url: new URL(adapter.endpointPath, `${adapter.origin}/`).toString(),
      method: 'POST',
      body: { query: operation.query, variables },
    },
  };
}
