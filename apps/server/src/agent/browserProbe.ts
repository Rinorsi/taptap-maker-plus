export type AgentBrowserProbeResult = {
  requestedUrl: string;
  finalUrl?: string;
  ok: boolean;
  status?: number;
  statusText?: string;
  contentType?: string;
  title?: string;
  error?: string;
  durationMs: number;
  checkedAt: string;
};

const MAX_HTML_BYTES = 256 * 1024;

export async function probeAgentBrowserUrl(url: string): Promise<AgentBrowserProbeResult> {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported browser probe protocol: ${parsed.protocol}`);
  }
  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml,text/plain,*/*",
        "User-Agent": "TapTap-Maker-Plus-Agent-Browser-Probe"
      }
    });
    clearTimeout(timeout);
    const contentType = response.headers.get("content-type") ?? undefined;
    const title = contentType?.toLowerCase().includes("text/html")
      ? extractHtmlTitle(await readLimitedText(response))
      : undefined;
    return {
      requestedUrl: parsed.toString(),
      finalUrl: response.url,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType,
      title,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      requestedUrl: parsed.toString(),
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    };
  }
}

async function readLimitedText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_HTML_BYTES) {
    const next = await reader.read();
    if (next.done) break;
    chunks.push(next.value);
    total += next.value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return Buffer.concat(chunks, Math.min(total, MAX_HTML_BYTES)).toString("utf8");
}

function extractHtmlTitle(html: string) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return undefined;
  return decodeHtmlText(match[1]).trim().slice(0, 240) || undefined;
}

function decodeHtmlText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
