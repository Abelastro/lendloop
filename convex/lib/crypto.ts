const encoder = new TextEncoder();
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isFreshTimestamp(timestamp: string, windowSeconds = 300): boolean {
  if (!/^\d{10,13}$/.test(timestamp)) return false;
  const numeric = Number(timestamp);
  const millis = timestamp.length <= 10 ? numeric * 1000 : numeric;
  return Math.abs(Date.now() - millis) <= windowSeconds * 1000;
}

export async function signPayload(
  secret: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  );
  return toHex(signature);
}

export async function verifySignature(
  secret: string,
  timestamp: string,
  signature: string,
  body: string,
): Promise<boolean> {
  if (!SIGNATURE_PATTERN.test(signature)) return false;
  const expected = await signPayload(secret, timestamp, body);
  const left = encoder.encode(signature);
  const right = encoder.encode(expected);
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index]! ^ right[index]!;
  }
  return mismatch === 0;
}

export async function createSignatureHeaders(
  secret: string,
  body: string,
  idempotencyKey: string,
): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await signPayload(secret, timestamp, body);
  return {
    "content-type": "application/json",
    "x-lendloop-timestamp": timestamp,
    "x-lendloop-signature": signature,
    "x-lendloop-idempotency-key": idempotencyKey,
  };
}
