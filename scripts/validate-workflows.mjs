import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function loadWorkflows(directory, label) {
  const dir = join(process.cwd(), "workflows", directory);
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  if (files.length !== 3) {
    throw new Error(`${label}: expected three workflow JSON files.`);
  }

  return files.map((file) => {
    const path = join(dir, file);
    const raw = readFileSync(path, "utf8");
    let workflow;
    try {
      workflow = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${label}/${file} is not valid JSON: ${error.message}`);
    }
    return { file, raw, workflow };
  });
}

function validateWorkflows(workflows, label, environment) {
  const ids = new Set();

  for (const { file, raw, workflow } of workflows) {
    const names = new Set();
    if (
      !workflow.name ||
      !Array.isArray(workflow.nodes) ||
      workflow.nodes.length === 0
    ) {
      throw new Error(`${label}/${file} is missing a name or nodes`);
    }
    if (!workflow.connections || typeof workflow.connections !== "object") {
      throw new Error(`${label}/${file} is missing connections`);
    }
    if (ids.has(workflow.id)) {
      throw new Error(`${label}/${file} has a duplicate workflow id`);
    }
    ids.add(workflow.id);

    for (const node of workflow.nodes) {
      if (!node.id || !node.name || !node.type) {
        throw new Error(`${label}/${file} has a malformed node`);
      }
      if (names.has(node.name)) {
        throw new Error(`${label}/${file} has duplicate node name ${node.name}`);
      }
      names.add(node.name);
    }

    for (const [source, outputs] of Object.entries(workflow.connections)) {
      if (!names.has(source)) {
        throw new Error(`${label}/${file} connects from missing node ${source}`);
      }
      for (const branches of outputs.main ?? []) {
        for (const target of branches ?? []) {
          if (!names.has(target.node)) {
            throw new Error(`${label}/${file} connects to missing node ${target.node}`);
          }
        }
      }
    }

    const secretSignatures = [
      /xox[baprs]-[A-Za-z0-9-]{10,}/,
      /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/,
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    ];
    for (const pattern of secretSignatures) {
      if (pattern.test(raw)) {
        throw new Error(`${label}/${file} appears to contain a hardcoded credential`);
      }
    }

    if (environment === "cloud" && raw.includes("$env")) {
      throw new Error(`${label}/${file} must not read $env on n8n Cloud`);
    }
    if (environment === "cloud" && !raw.includes("$vars.")) {
      throw new Error(`${label}/${file} must read configuration from $vars`);
    }
    if (environment === "self-hosted" && raw.includes("$vars.")) {
      throw new Error(`${label}/${file} must read configuration from $env`);
    }
  }

  for (const { file, workflow } of workflows) {
    if (workflow.settings?.errorWorkflow && !ids.has(workflow.settings.errorWorkflow)) {
      throw new Error(`${label}/${file} references a missing error workflow`);
    }
  }

  const byFile = Object.fromEntries(
    workflows.map((entry) => [entry.file, entry.workflow]),
  );
  const notify = byFile["request-notifications.json"];
  const overdue = byFile["daily-overdue-reminders.json"];
  const errors = byFile["error-handler.json"];

  const has = (workflow, type) => workflow?.nodes.some((node) => node.type === type);
  const code = (workflow) =>
    workflow.nodes
      .filter((node) => node.type === "n8n-nodes-base.code")
      .map((node) => node.parameters?.jsCode ?? "")
      .join("\n");

  if (!has(notify, "n8n-nodes-base.webhook")) {
    throw new Error(`${label}/request-notifications needs a webhook trigger`);
  }
  if (
    !code(notify).includes("timingSafeEqual") ||
    !code(notify).includes("createHmac")
  ) {
    throw new Error(`${label}/request-notifications must verify an HMAC signature`);
  }
  if (!has(notify, "n8n-nodes-base.respondToWebhook")) {
    throw new Error(`${label}/request-notifications must respond to the webhook`);
  }

  if (!has(overdue, "n8n-nodes-base.scheduleTrigger")) {
    throw new Error(`${label}/daily-overdue-reminders needs a schedule trigger`);
  }
  const overdueRaw = JSON.stringify(overdue);
  if (!overdueRaw.includes("/n8n/overdue") || !overdueRaw.includes("/n8n/reminders")) {
    throw new Error(`${label}/daily-overdue-reminders must fetch and write back`);
  }
  if (!code(overdue).includes("createHmac")) {
    throw new Error(`${label}/daily-overdue-reminders must sign requests`);
  }

  if (!has(errors, "n8n-nodes-base.errorTrigger")) {
    throw new Error(`${label}/error-handler needs an Error Trigger`);
  }
  if (!JSON.stringify(errors).includes("/n8n/incidents")) {
    throw new Error(`${label}/error-handler must report incidents`);
  }

  console.log(`Validated ${workflows.length} ${label} workflows:`);
  for (const { file, workflow } of workflows) {
    console.log(`  ${file} — ${workflow.nodes.length} nodes`);
  }
}

validateWorkflows(loadWorkflows("", "self-hosted"), "self-hosted", "self-hosted");
validateWorkflows(loadWorkflows("cloud", "cloud"), "cloud", "cloud");
