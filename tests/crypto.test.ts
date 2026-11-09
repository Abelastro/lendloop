import { describe, expect, it } from "vitest";
import {
  createSignatureHeaders,
  isFreshTimestamp,
  signPayload,
  verifySignature,
} from "../convex/lib/crypto";

const key = "test-only-signing-key";
const timestamp = Math.floor(Date.now() / 1000).toString();

describe("HMAC signing", () => {
  it("produces a stable SHA-256 signature", async () => {
    const signature = await signPayload(key, timestamp, '{"hello":"world"}');
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(await verifySignature(key, timestamp, signature, '{"hello":"world"}')).toBe(
      true,
    );
  });

  it("rejects a changed body or wrong key", async () => {
    const signature = await signPayload(key, timestamp, '{"amount":1}');
    expect(await verifySignature(key, timestamp, signature, '{"amount":2}')).toBe(
      false,
    );
    expect(
      await verifySignature("another-key", timestamp, signature, '{"amount":1}'),
    ).toBe(false);
  });

  it("rejects malformed signatures without throwing", async () => {
    expect(await verifySignature(key, timestamp, "not-hex", "body")).toBe(false);
  });

  it("creates fresh headers with an idempotency key", async () => {
    const headers = await createSignatureHeaders(key, "body", "event:123");
    expect(headers["x-lendloop-idempotency-key"]).toBe("event:123");
    expect(
      await verifySignature(
        key,
        headers["x-lendloop-timestamp"]!,
        headers["x-lendloop-signature"]!,
        "body",
      ),
    ).toBe(true);
  });

  it("enforces the five minute timestamp window", () => {
    const nowSeconds = Math.floor(Date.now() / 1000).toString();
    const oldSeconds = (Math.floor(Date.now() / 1000) - 301).toString();
    expect(isFreshTimestamp(nowSeconds)).toBe(true);
    expect(isFreshTimestamp(oldSeconds)).toBe(false);
    expect(isFreshTimestamp("not-a-timestamp")).toBe(false);
  });
});
