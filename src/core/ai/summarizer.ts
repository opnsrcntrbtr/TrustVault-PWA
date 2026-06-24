/**
 * Summarizer API wrapper (Chrome built-in). Standalone from the LanguageModel
 * provider, matching how Chrome ships these APIs. Returns null when unavailable
 * so callers can fall back. Sessions are ephemeral (destroyed per call).
 */
interface SummarizerSession {
  summarize(input: string, opts?: { signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}
interface SummarizerStatic {
  availability(): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  create(opts?: object): Promise<SummarizerSession>;
}

function getSummarizer(): SummarizerStatic | null {
  const s = (globalThis as Record<string, unknown>).Summarizer as SummarizerStatic | undefined;
  return s && typeof s.create === 'function' && typeof s.availability === 'function' ? s : null;
}

export async function isSummarizerAvailable(): Promise<boolean> {
  const s = getSummarizer();
  if (!s) return false;
  try { return (await s.availability()) === 'available'; } catch { return false; }
}

export async function summarize(text: string, signal?: AbortSignal): Promise<string | null> {
  const s = getSummarizer();
  if (!s) return null;
  try {
    if ((await s.availability()) !== 'available') return null;
    const session = await s.create();
    try {
      return await session.summarize(text, signal ? { signal } : undefined);
    } finally {
      session.destroy();
    }
  } catch {
    return null;
  }
}
