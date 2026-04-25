import { createRequire } from 'node:module';

interface PackageMetadata {
  name: string;
  version: string;
}

const require = createRequire(import.meta.url);
const packageMetadata = require('../package.json') as PackageMetadata;

export const MCP_SERVER_INFO = {
  name: packageMetadata.name,
  version: packageMetadata.version,
};

export const MCP_SERVER_DESCRIPTION =
  'MCP server for token-efficient error2fix diagnosis workflows: compact failure diagnosis, focused evidence queries, and safe runtime context.';
