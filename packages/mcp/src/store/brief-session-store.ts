import type {
  CoreAnalysis,
  CoreAnalysisInput,
  LatestRawCapture,
} from '@error2fix/core';

export interface BriefSessionContext {
  sessionId: string;
  capture: LatestRawCapture;
  input: CoreAnalysisInput;
  analysis: CoreAnalysis;
}

const briefSessions = new Map<string, BriefSessionContext>();
let latestBriefSessionId: string | undefined;

export function rememberBriefSession(
  sessionId: string,
  capture: LatestRawCapture,
  input: CoreAnalysisInput,
  analysis: CoreAnalysis,
): void {
  briefSessions.set(sessionId, {
    sessionId,
    capture,
    input,
    analysis,
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
