import type { CoreAnalysisInput, LatestRawCapture } from '@error2fix/core';

export interface BriefSessionContext {
  sessionId: string;
  capture: LatestRawCapture;
  input: CoreAnalysisInput;
}

const briefSessions = new Map<string, BriefSessionContext>();
let latestBriefSessionId: string | undefined;

export function rememberBriefSession(
  sessionId: string,
  capture: LatestRawCapture,
  input: CoreAnalysisInput,
): void {
  briefSessions.set(sessionId, {
    sessionId,
    capture,
    input,
  });
  latestBriefSessionId = sessionId;
}

export function resolveBriefSession(
  sessionId: string | undefined,
): BriefSessionContext | undefined {
  if (sessionId) {
    return briefSessions.get(sessionId);
  }
  return latestBriefSessionId
    ? briefSessions.get(latestBriefSessionId)
    : undefined;
}
