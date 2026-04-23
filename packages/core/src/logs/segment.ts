import type { LogSegment, NormalizedLog, SegmentedLog } from './types.js';

function isBoundaryLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return true;
  }

  return (
    /^(error|exception|caused by|traceback|panic:|fatal:|fail(?:ed)?\b)/i.test(
      trimmed,
    ) ||
    /^at\s+/i.test(trimmed) ||
    /^#\d+\s/.test(trimmed) ||
    /\bline\s+\d+\b/i.test(trimmed)
  );
}

function segmentLines(source: LogSegment['source'], lines: string[]): LogSegment[] {
  const segments: LogSegment[] = [];
  let current: string[] = [];
  let startLine = 0;

  const flush = (endIndex: number) => {
    if (current.length === 0) {
      return;
    }

    segments.push({
      id: `${source}:${startLine + 1}-${endIndex + 1}`,
      source,
      text: current.join('\n'),
      lines: [...current],
      startLine,
      endLine: endIndex,
    });
    current = [];
  };

  lines.forEach((line, index) => {
    const hasCurrent = current.length > 0;
    const boundary = isBoundaryLine(line);

    if (!hasCurrent) {
      startLine = index;
      current.push(line);
      return;
    }

    if (line.trim().length === 0) {
      flush(index - 1);
      return;
    }

    if (boundary && current.length >= 2) {
      flush(index - 1);
      startLine = index;
      current.push(line);
      return;
    }

    current.push(line);
  });

  flush(lines.length - 1);
  return segments;
}

export function segmentLogs(log: NormalizedLog): SegmentedLog {
  return {
    segments: [
      ...segmentLines('stderr', log.stderrLines),
      ...segmentLines('stdout', log.stdoutLines),
      ...segmentLines('combined', log.combinedLines),
    ],
  };
}
