import assert from "node:assert/strict";

function createFlowId(name: string) {
  const normalized = name.trim();
  const ascii = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return ascii || `flow-${Date.now()}`;
}

function withFlowDisplayName(data: unknown, displayName: string) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    const meta = record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
      ? record.meta as Record<string, unknown>
      : {};
    return {
      ...record,
      meta: {
        ...meta,
        displayName,
        updatedAt: "test",
      },
    };
  }
  return {
    meta: { displayName, updatedAt: "test" },
    data,
  };
}

const displayName = "我的画布-02-06-24";
const id = createFlowId(displayName);
const payload = withFlowDisplayName({ schema: "taptap.canvas.video.v1" }, displayName) as {
  meta: { displayName: string };
};

assert.ok(id.length > 0);
assert.equal(payload.meta.displayName, displayName);

console.log("flow display name verified");
