import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type WorkflowNode = {
  name: string;
  type: string;
  parameters?: { jsCode?: string };
};

type ConnectionTarget = { node: string };

type Workflow = {
  name: string;
  nodes: WorkflowNode[];
  connections: Record<string, { main?: ConnectionTarget[][] }>;
  settings?: { errorWorkflow?: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseWorkflow(raw: string, file: string): Workflow {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) throw new Error(`${file} must be a JSON object.`);
  if (
    typeof parsed.name !== "string" ||
    !Array.isArray(parsed.nodes) ||
    !isRecord(parsed.connections)
  ) {
    throw new Error(`${file} is missing a name, nodes, or connections.`);
  }

  const nodes = parsed.nodes.map((value) => {
    if (
      !isRecord(value) ||
      typeof value.name !== "string" ||
      typeof value.type !== "string"
    ) {
      throw new Error(`${file} has a malformed node.`);
    }
    const parameters =
      isRecord(value.parameters) && typeof value.parameters.jsCode === "string"
        ? { jsCode: value.parameters.jsCode }
        : undefined;
    return { name: value.name, type: value.type, parameters };
  });

  const connections: Workflow["connections"] = {};
  for (const [source, output] of Object.entries(parsed.connections)) {
    if (!isRecord(output)) throw new Error(`${file} has malformed connections.`);
    const rawMain = output.main;
    if (rawMain === undefined) continue;
    if (!Array.isArray(rawMain)) throw new Error(`${file} has malformed connections.`);
    const main = rawMain.map((branch) => {
      if (!Array.isArray(branch)) {
        throw new Error(`${file} has malformed connections.`);
      }
      return branch.map((target) => {
        if (!isRecord(target) || typeof target.node !== "string") {
          throw new Error(`${file} has a malformed connection target.`);
        }
        return { node: target.node };
      });
    });
    connections[source] = { main };
  }

  const settings =
    isRecord(parsed.settings) && typeof parsed.settings.errorWorkflow === "string"
      ? { errorWorkflow: parsed.settings.errorWorkflow }
      : undefined;

  return { name: parsed.name, nodes, connections, settings };
}

function load(file: string): { raw: string; workflow: Workflow } {
  const raw = readFileSync(join(process.cwd(), "workflows", file), "utf8");
  return { raw, workflow: parseWorkflow(raw, file) };
}

function loadCloud(file: string): { raw: string; workflow: Workflow } {
  const raw = readFileSync(join(process.cwd(), "workflows", "cloud", file), "utf8");
  return { raw, workflow: parseWorkflow(raw, file) };
}

describe("exported n8n workflows", () => {
  it("contains the three expected workflows", () => {
    expect(load("request-notifications.json").workflow.nodes.length).toBeGreaterThan(0);
    expect(load("daily-overdue-reminders.json").workflow.nodes.length).toBeGreaterThan(
      0,
    );
    expect(load("error-handler.json").workflow.nodes.length).toBeGreaterThan(0);
  });

  it("connects only to nodes that exist", () => {
    for (const file of [
      "request-notifications.json",
      "daily-overdue-reminders.json",
      "error-handler.json",
    ]) {
      const { workflow } = load(file);
      const names = new Set(workflow.nodes.map((node) => node.name));
      for (const [source, output] of Object.entries(workflow.connections)) {
        expect(names.has(source), `${file}: ${source}`).toBe(true);
        for (const branch of output.main ?? []) {
          for (const target of branch ?? []) {
            expect(names.has(target.node), `${file}: ${target.node}`).toBe(true);
          }
        }
      }
    }
  });

  it("uses HMAC verification in the inbound webhook", () => {
    const { workflow } = load("request-notifications.json");
    const code = workflow.nodes.map((node) => node.parameters?.jsCode ?? "").join("\n");
    expect(workflow.nodes.some((node) => node.type.endsWith(".webhook"))).toBe(true);
    expect(code).toContain("createHmac");
    expect(code).toContain("timingSafeEqual");
  });

  it("fetches and writes back overdue reminders with signing", () => {
    const { raw, workflow } = load("daily-overdue-reminders.json");
    expect(workflow.nodes.some((node) => node.type.endsWith(".scheduleTrigger"))).toBe(
      true,
    );
    expect(raw).toContain("/n8n/overdue");
    expect(raw).toContain("/n8n/reminders");
    expect(raw).toContain("createHmac");
  });

  it("passes idempotency keys on signed write-backs", () => {
    for (const loadWorkflow of [load, loadCloud]) {
      const overdue = loadWorkflow("daily-overdue-reminders.json");
      const error = loadWorkflow("error-handler.json");
      expect(overdue.raw).toContain("x-lendloop-idempotency-key");
      expect(overdue.raw).toContain("overdue-batch-");
      expect(error.raw).toContain("x-lendloop-idempotency-key");
      expect(error.raw).toContain("incident-");
    }
  });

  it("reports failures through the error workflow", () => {
    const { raw, workflow } = load("error-handler.json");
    expect(workflow.nodes.some((node) => node.type.endsWith(".errorTrigger"))).toBe(
      true,
    );
    expect(raw).toContain("/n8n/incidents");
  });

  it("generates n8n Cloud variants that use $vars instead of $env", () => {
    for (const file of [
      "request-notifications.json",
      "daily-overdue-reminders.json",
      "error-handler.json",
    ]) {
      const { raw, workflow } = loadCloud(file);
      expect(workflow.nodes.length).toBe(load(file).workflow.nodes.length);
      expect(raw).toContain("$vars.");
      expect(raw).not.toContain("$env");
      expect(raw).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{10,}/);
      expect(raw).not.toContain("BEGIN PRIVATE KEY");
    }
  });

  it("does not embed credentials or secrets", () => {
    for (const file of [
      "request-notifications.json",
      "daily-overdue-reminders.json",
      "error-handler.json",
    ]) {
      const { raw } = load(file);
      expect(raw).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{10,}/);
      expect(raw).not.toMatch(/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/);
      expect(raw).not.toContain("BEGIN PRIVATE KEY");
    }
  });
});
