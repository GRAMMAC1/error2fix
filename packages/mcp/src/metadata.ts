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
  'MCP server for token-efficient frontend failure diagnosis workflows: compact JavaScript/TypeScript build, test, dependency, bundler, and framework error briefs with focused evidence queries.';
