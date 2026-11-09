function readEnv(...parts: string[]): string | undefined {
  const value = process.env[parts.join("_")];
  return value?.trim() || undefined;
}

export function getOutboundSigningKey(): string | undefined {
  return readEnv("N8N", "OUTBOUND", "SECRET");
}

export function getInboundSigningKey(): string | undefined {
  return readEnv("N8N", "INBOUND", "SECRET");
}

export function n8nWebhookUrl(): string | undefined {
  return readEnv("N8N", "WEBHOOK", "URL");
}

export type NotificationRouting = "email" | "slack" | "mock";

export function notificationRouting(): NotificationRouting {
  const value = readEnv("NOTIFICATION", "ROUTING")?.toLowerCase();
  if (value === "email") return "email";
  if (value === "slack") return "slack";
  return "mock";
}
