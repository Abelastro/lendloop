import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "workflows");
mkdirSync(OUT, { recursive: true });

const ERROR_ID = "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b";
const NOTIFY_ID = "3f6b2c1a-7d4e-4f1a-9b2c-1a2b3c4d5e6f";
const OVERDUE_ID = "8c2d4e6f-1a3b-4c5d-8e7f-9a0b1c2d3e4f";

const verifyRequest = `const crypto = require('crypto');
const headers = $json.headers ?? {};
const raw = typeof $json.body === 'string'
  ? $json.body
  : Buffer.isBuffer($json.body)
    ? $json.body.toString('utf8')
    : JSON.stringify($json.body ?? {});
const timestamp = String(headers['x-lendloop-timestamp'] ?? '');
const signature = String(headers['x-lendloop-signature'] ?? '');
const key = $env[['LENDLOOP', 'INBOUND', 'SECRET'].join('_')];

if (!key) throw new Error('LENDLOOP_INBOUND_SECRET is not configured');
if (!/^\\d{10,13}$/.test(timestamp)) throw new Error('Missing timestamp');
const numeric = Number(timestamp);
const age = Math.abs(Date.now() - (timestamp.length <= 10 ? numeric * 1000 : numeric));
if (age > 300000) throw new Error('Stale signature timestamp');

const expected = crypto.createHmac('sha256', key).update(timestamp + '.' + raw).digest('hex');
const a = Buffer.from(expected, 'hex');
const b = Buffer.from(signature, 'hex');
if (!/^[a-f0-9]{64}$/.test(signature) || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
  throw new Error('Invalid signature');
}

let event;
try {
  event = JSON.parse(raw);
} catch {
  throw new Error('Request body must be JSON');
}

const template = {
  'request.created': \`New request for \${event.tool?.name ?? 'a tool'} from \${event.actor?.name ?? 'a neighbor'} (\${event.loan?.startDate ?? '?'} to \${event.loan?.endDate ?? '?'}). Approve or decline in LendLoop.\`,
  'request.approved': \`Your request for \${event.tool?.name ?? 'a tool'} was approved by \${event.actor?.name ?? 'the lender'} (\${event.loan?.startDate ?? '?'} to \${event.loan?.endDate ?? '?'}).\`,
  'request.declined': \`Your request for \${event.tool?.name ?? 'a tool'} was declined by \${event.actor?.name ?? 'the lender'}.\`,
  'request.cancelled': \`\${event.actor?.name ?? 'The borrower'} cancelled the request for \${event.tool?.name ?? 'a tool'}.\`,
  'loan.returned': \`\${event.tool?.name ?? 'A tool'} was marked returned by \${event.actor?.name ?? 'a neighbor'}.\`,
};

const slackUrl = $env[['LENDLOOP', 'SLACK', 'WEBHOOK', 'URL'].join('_')];
const recipientEmail = String(event.recipient?.email ?? '');
const resendKey = $env[['LENDLOOP', 'RESEND', 'API', 'KEY'].join('_')];
const fromEmail = $env[['LENDLOOP', 'NOTIFICATION', 'FROM', 'EMAIL'].join('_')];
const canEmail = Boolean(recipientEmail && resendKey && fromEmail);
const channel = canEmail ? 'email' : slackUrl ? 'slack' : 'mock';
const subject = {
  'request.created': 'New LendLoop borrow request',
  'request.approved': 'Your LendLoop request was approved',
  'request.declined': 'Your LendLoop request was declined',
  'request.cancelled': 'A LendLoop request was cancelled',
  'loan.returned': 'A LendLoop tool was returned',
}[event.type] ?? 'LendLoop update';
const text = template[event.type] ?? \`LendLoop update: \${event.type ?? 'automation event'}\`;

if (channel === 'mock') console.log('[mock notification] ' + text);

return {
  json: {
    eventId: String(event.id ?? ''),
    type: String(event.type ?? 'unknown'),
    channel,
    slackUrl: slackUrl || '',
    recipientEmail,
    fromEmail: fromEmail || '',
    subject,
    text,
  },
};`;

const signOverdueRequest = `const crypto = require('crypto');
const key = $env[['LENDLOOP', 'OUTBOUND', 'SECRET'].join('_')];
if (!key) throw new Error('LENDLOOP_OUTBOUND_SECRET is not configured');
const base = $env.LENDLOOP_CONVEX_SITE_URL;
if (!base) throw new Error('LENDLOOP_CONVEX_SITE_URL is not configured');
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = crypto.createHmac('sha256', key).update(timestamp + '.').digest('hex');
return [
  {
    json: {
      headers: {
        'content-type': 'application/json',
        'x-lendloop-timestamp': timestamp,
        'x-lendloop-signature': signature,
      },
    },
  },
];`;

const expandLoans = `const response = $input.first().json;
const loans = Array.isArray(response.loans) ? response.loans : [];
return loans.map((loan) => ({ json: { date: response.date, ...loan } }));`;

const prepareReminder = `const loan = $json;
const slackUrl = $env[['LENDLOOP', 'SLACK', 'WEBHOOK', 'URL'].join('_')];
const recipientEmail = String(loan.borrowerEmail ?? '');
const resendKey = $env[['LENDLOOP', 'RESEND', 'API', 'KEY'].join('_')];
const fromEmail = $env[['LENDLOOP', 'NOTIFICATION', 'FROM', 'EMAIL'].join('_')];
const canEmail = Boolean(recipientEmail && resendKey && fromEmail);
const channel = canEmail ? 'email' : slackUrl ? 'slack' : 'mock';
const subject = 'LendLoop overdue reminder: ' + loan.toolName;
const text = \`Overdue reminder: \${loan.toolName} was due \${loan.endDate} (\${loan.daysOverdue} day(s) ago). Borrowed by \${loan.borrowerName}. Please return it or update LendLoop.\`;
if (channel === 'mock') console.log('[mock reminder] ' + text);
return {
  json: {
    ...loan,
    text,
    slackUrl: slackUrl || '',
    recipientEmail,
    fromEmail: fromEmail || '',
    subject,
    channel,
  },
};`;

const slackReceipt = `const prepared = $('Prepare reminder').item.json;
return {
  json: {
    loanId: prepared.loanId,
    date: prepared.date,
    channel: 'slack',
    status: 'sent',
    sentAt: Date.now(),
    providerMessageId: $json.message_id ? String($json.message_id) : undefined,
  },
};`;

const emailReceipt = `const prepared = $('Prepare reminder').item.json;
return {
  json: {
    loanId: prepared.loanId,
    date: prepared.date,
    channel: 'email',
    status: 'sent',
    sentAt: Date.now(),
    providerMessageId: $json.id ? String($json.id) : undefined,
  },
};`;

const mockReceipt = `const prepared = $json;
return {
  json: {
    loanId: prepared.loanId,
    date: prepared.date,
    channel: 'mock',
    status: 'sent',
    sentAt: Date.now(),
    providerMessageId: 'mock-' + prepared.loanId + '-' + prepared.date,
  },
};`;

const signReminderWriteback = `const crypto = require('crypto');
const key = $env[['LENDLOOP', 'OUTBOUND', 'SECRET'].join('_')];
if (!key) throw new Error('LENDLOOP_OUTBOUND_SECRET is not configured');
const rows = $input.all().map((item) => item.json);
if (!rows.length) return [];
const reminders = rows.map((row) => ({
  loanId: row.loanId,
  channel: row.channel,
  status: row.status,
  sentAt: row.sentAt,
  providerMessageId: row.providerMessageId || undefined,
}));
const body = JSON.stringify({ reminders, date: rows[0].date || undefined });
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = crypto.createHmac('sha256', key).update(timestamp + '.' + body).digest('hex');
return [
  {
    json: {
      body,
      headers: {
        'content-type': 'application/json',
        'x-lendloop-timestamp': timestamp,
        'x-lendloop-signature': signature,
        'x-lendloop-idempotency-key': 'overdue-batch-' + (rows[0].date ?? 'unknown'),
      },
    },
  },
];`;

const signIncident = `const crypto = require('crypto');
const key = $env[['LENDLOOP', 'OUTBOUND', 'SECRET'].join('_')];
if (!key) throw new Error('LENDLOOP_OUTBOUND_SECRET is not configured');
const data = $input.first().json ?? {};
const execution = data.execution ?? {};
const workflow = data.workflow ?? {};
const message = String(
  execution.error?.message ?? execution.error ?? 'Unspecified workflow failure',
)
  .replace(/https?:\\/\\/\\S+/gi, '[redacted-url]')
  .replace(/\\b(?:xox[baprs]-|sk_(?:live|test)_)[A-Za-z0-9_-]+\\b/gi, '[redacted-token]')
  .replace(/\\s+/g, ' ')
  .slice(0, 500);
const payload = {
  workflow: String(workflow.name ?? 'unknown-workflow'),
  executionId: String(execution.id ?? 'unknown-' + Date.now()),
  node: execution.lastNodeExecuted ? String(execution.lastNodeExecuted) : undefined,
  message,
};
const body = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = crypto.createHmac('sha256', key).update(timestamp + '.' + body).digest('hex');
return [
  {
    json: {
      body,
      headers: {
        'content-type': 'application/json',
        'x-lendloop-timestamp': timestamp,
        'x-lendloop-signature': signature,
        'x-lendloop-idempotency-key': 'incident-' + payload.executionId,
      },
    },
  },
];`;

const headerParams = (
  source = "$json.headers",
  { includeIdempotency = true } = {},
) => ({
  parameters: [
    {
      name: "content-type",
      value: `={{ ${source}['content-type'] }}`,
    },
    {
      name: "x-lendloop-timestamp",
      value: `={{ ${source}['x-lendloop-timestamp'] }}`,
    },
    {
      name: "x-lendloop-signature",
      value: `={{ ${source}['x-lendloop-signature'] }}`,
    },
    ...(includeIdempotency
      ? [
          {
            name: "x-lendloop-idempotency-key",
            value: `={{ ${source}['x-lendloop-idempotency-key'] }}`,
          },
        ]
      : []),
  ],
});

const notifications = {
  id: NOTIFY_ID,
  name: "LendLoop - Request notifications",
  active: false,
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: "lendloop/notifications",
        responseMode: "responseNode",
        options: { rawBody: true },
      },
      id: "b3e1f2a4-5c6d-4e7f-8a9b-0c1d2e3f4a5b",
      name: "Convex webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [-720, 0],
      webhookId: NOTIFY_ID,
    },
    {
      parameters: {
        mode: "runOnceForEachItem",
        jsCode: verifyRequest,
      },
      id: "c4f2a3b5-6d7e-4f8a-9b0c-1d2e3f4a5b6c",
      name: "Verify signature and compose",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [-500, 0],
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 2,
          },
          conditions: [
            {
              id: "d5a3b4c6-7e8f-4a9b-8c1d-2e3f4a5b6c7d",
              leftValue: "={{ $json.slackUrl }}",
              rightValue: "",
              operator: {
                type: "string",
                operation: "notEmpty",
                singleValue: true,
              },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      id: "e6b4c5d7-8f9a-4b1c-9d2e-3f4a5b6c7d8e",
      name: "Slack configured?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [-260, 0],
    },
    {
      parameters: {
        method: "POST",
        url: "={{ $json.slackUrl }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify({ text: $json.text }) }}",
        options: { timeout: 10000 },
      },
      id: "f7c5d6e8-9a0b-4c2d-8e3f-4a5b6c7d8e9f",
      name: "Post to Slack",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [0, -120],
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: "={{ JSON.stringify({ ok: true, channel: 'slack' }) }}",
        options: {},
      },
      id: "a8d6e7f9-0b1c-4d3e-9f4a-5b6c7d8e9f0a",
      name: "Respond delivered",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [260, -120],
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: "={{ JSON.stringify({ ok: true, channel: 'mock' }) }}",
        options: {},
      },
      id: "b9e7f8a0-1c2d-4e4f-8a5b-6c7d8e9f0a1b",
      name: "Respond mock",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [40, 140],
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 2,
          },
          conditions: [
            {
              id: "f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
              leftValue: "={{ $json.channel }}",
              rightValue: "email",
              operator: {
                type: "string",
                operation: "equals",
                singleValue: true,
              },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      id: "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
      name: "Email configured?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [-260, -160],
    },
    {
      parameters: {
        method: "POST",
        url: "https://api.resend.com/emails",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "Authorization",
              value: "=Bearer {{ $env.LENDLOOP_RESEND_API_KEY }}",
            },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ JSON.stringify({ from: $json.fromEmail, to: $json.recipientEmail, subject: $json.subject, text: $json.text }) }}",
        options: { timeout: 10000 },
      },
      id: "b3c4d5e6-f7a8-4b9c-8d1e-2f3a4b5c6d7e",
      name: "Send email",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [0, -160],
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
    },
    {
      parameters: {
        respondWith: "json",
        responseBody: "={{ JSON.stringify({ ok: true, channel: 'email' }) }}",
        options: {},
      },
      id: "c4d5e6f7-a8b9-4c0d-9e2f-3a4b5c6d7e8f",
      name: "Respond emailed",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [260, -160],
    },
  ],
  connections: {
    "Convex webhook": {
      main: [[{ node: "Verify signature and compose", type: "main", index: 0 }]],
    },
    "Verify signature and compose": {
      main: [[{ node: "Email configured?", type: "main", index: 0 }]],
    },
    "Email configured?": {
      main: [
        [{ node: "Send email", type: "main", index: 0 }],
        [{ node: "Slack configured?", type: "main", index: 0 }],
      ],
    },
    "Send email": {
      main: [[{ node: "Respond emailed", type: "main", index: 0 }]],
    },
    "Slack configured?": {
      main: [
        [{ node: "Post to Slack", type: "main", index: 0 }],
        [{ node: "Respond mock", type: "main", index: 0 }],
      ],
    },
    "Post to Slack": {
      main: [[{ node: "Respond delivered", type: "main", index: 0 }]],
    },
  },
  settings: {
    executionOrder: "v1",
    errorWorkflow: ERROR_ID,
    saveManualExecutions: true,
  },
  staticData: null,
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};

const overdue = {
  id: OVERDUE_ID,
  name: "LendLoop - Daily overdue reminders",
  active: false,
  nodes: [
    {
      parameters: {
        rule: {
          interval: [{ field: "days", triggerAtHour: 14, triggerAtMinute: 0 }],
        },
      },
      id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
      name: "Daily at 14:00",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [-820, 0],
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        jsCode: signOverdueRequest,
      },
      id: "d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a",
      name: "Sign overdue request",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [-600, 0],
    },
    {
      parameters: {
        method: "GET",
        url: "={{ $env.LENDLOOP_CONVEX_SITE_URL + '/n8n/overdue' }}",
        sendHeaders: true,
        headerParameters: headerParams(undefined, { includeIdempotency: false }),
        options: { timeout: 15000 },
      },
      id: "e3f4a5b6-c7d8-4e9f-8a0b-1c2d3e4f5a6b",
      name: "Fetch overdue loans",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [-380, 0],
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        jsCode: expandLoans,
      },
      id: "f4a5b6c7-d8e9-4f0a-9b1c-2d3e4f5a6b7c",
      name: "Expand loans",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [-160, 0],
    },
    {
      parameters: {
        mode: "runOnceForEachItem",
        jsCode: prepareReminder,
      },
      id: "a5b6c7d8-e9f0-4a1b-8c2d-3e4f5a6b7c8d",
      name: "Prepare reminder",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [60, 0],
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 2,
          },
          conditions: [
            {
              id: "b6c7d8e9-f0a1-4b2c-9d3e-4f5a6b7c8d9e",
              leftValue: "={{ $json.slackUrl }}",
              rightValue: "",
              operator: {
                type: "string",
                operation: "notEmpty",
                singleValue: true,
              },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      id: "c7d8e9f0-a1b2-4c3d-8e4f-5a6b7c8d9e0f",
      name: "Slack configured?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [280, 0],
    },
    {
      parameters: {
        method: "POST",
        url: "={{ $json.slackUrl }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify({ text: $json.text }) }}",
        options: { timeout: 10000 },
      },
      id: "d8e9f0a1-b2c3-4d4e-9f5a-6b7c8d9e0f1a",
      name: "Post Slack reminder",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [540, -120],
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
    },
    {
      parameters: {
        mode: "runOnceForEachItem",
        jsCode: slackReceipt,
      },
      id: "e9f0a1b2-c3d4-4e5f-8a6b-7c8d9e0f1a2b",
      name: "Slack receipt",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [780, -120],
    },
    {
      parameters: {
        mode: "runOnceForEachItem",
        jsCode: mockReceipt,
      },
      id: "f0a1b2c3-d4e5-4f6a-9b7c-8d9e0f1a2b3c",
      name: "Mock receipt",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [540, 140],
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        jsCode: signReminderWriteback,
      },
      id: "a1b2c3d4-e5f6-4a7b-8c8d-9e0f1a2b3c4d",
      name: "Sign reminder write-back",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1020, 0],
    },
    {
      parameters: {
        method: "POST",
        url: "={{ $env.LENDLOOP_CONVEX_SITE_URL + '/n8n/reminders' }}",
        sendHeaders: true,
        headerParameters: headerParams(),
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: "={{ $json.body }}",
        options: { timeout: 15000 },
      },
      id: "b2c3d4e5-f6a7-4b8c-9d9e-0f1a2b3c4d5e",
      name: "Write reminder results",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1260, 0],
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict",
            version: 2,
          },
          conditions: [
            {
              id: "d5e6f7a8-b9c0-4d1e-8f3a-4b5c6d7e8f9a",
              leftValue: "={{ $json.channel }}",
              rightValue: "email",
              operator: {
                type: "string",
                operation: "equals",
                singleValue: true,
              },
            },
          ],
          combinator: "and",
        },
        options: {},
      },
      id: "e6f7a8b9-c0d1-4e2f-9a4b-5c6d7e8f9a0b",
      name: "Email configured?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [280, -160],
    },
    {
      parameters: {
        method: "POST",
        url: "https://api.resend.com/emails",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "Authorization",
              value: "=Bearer {{ $env.LENDLOOP_RESEND_API_KEY }}",
            },
            { name: "Content-Type", value: "application/json" },
          ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ JSON.stringify({ from: $json.fromEmail, to: $json.recipientEmail, subject: $json.subject, text: $json.text }) }}",
        options: { timeout: 10000 },
      },
      id: "f7a8b9c0-d1e2-4f3a-8b4c-5d6e7f8a9b0c",
      name: "Send email reminder",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [540, -160],
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
    },
    {
      parameters: {
        mode: "runOnceForEachItem",
        jsCode: emailReceipt,
      },
      id: "a8b9c0d1-e2f3-4a4b-9c5d-6e7f8a9b0c1d",
      name: "Email receipt",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [780, -160],
    },
  ],
  connections: {
    "Daily at 14:00": {
      main: [[{ node: "Sign overdue request", type: "main", index: 0 }]],
    },
    "Sign overdue request": {
      main: [[{ node: "Fetch overdue loans", type: "main", index: 0 }]],
    },
    "Fetch overdue loans": {
      main: [[{ node: "Expand loans", type: "main", index: 0 }]],
    },
    "Expand loans": {
      main: [[{ node: "Prepare reminder", type: "main", index: 0 }]],
    },
    "Prepare reminder": {
      main: [[{ node: "Email configured?", type: "main", index: 0 }]],
    },
    "Email configured?": {
      main: [
        [{ node: "Send email reminder", type: "main", index: 0 }],
        [{ node: "Slack configured?", type: "main", index: 0 }],
      ],
    },
    "Send email reminder": {
      main: [[{ node: "Email receipt", type: "main", index: 0 }]],
    },
    "Email receipt": {
      main: [[{ node: "Sign reminder write-back", type: "main", index: 0 }]],
    },
    "Slack configured?": {
      main: [
        [{ node: "Post Slack reminder", type: "main", index: 0 }],
        [{ node: "Mock receipt", type: "main", index: 0 }],
      ],
    },
    "Post Slack reminder": {
      main: [[{ node: "Slack receipt", type: "main", index: 0 }]],
    },
    "Slack receipt": {
      main: [[{ node: "Sign reminder write-back", type: "main", index: 0 }]],
    },
    "Mock receipt": {
      main: [[{ node: "Sign reminder write-back", type: "main", index: 0 }]],
    },
    "Sign reminder write-back": {
      main: [[{ node: "Write reminder results", type: "main", index: 0 }]],
    },
  },
  settings: {
    executionOrder: "v1",
    errorWorkflow: ERROR_ID,
    saveManualExecutions: true,
  },
  staticData: null,
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};

const errorHandler = {
  id: ERROR_ID,
  name: "LendLoop - Automation error handler",
  active: true,
  nodes: [
    {
      parameters: {},
      id: "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
      name: "Error trigger",
      type: "n8n-nodes-base.errorTrigger",
      typeVersion: 1,
      position: [-520, 0],
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        jsCode: signIncident,
      },
      id: "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f7a",
      name: "Sign incident",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [-280, 0],
    },
    {
      parameters: {
        method: "POST",
        url: "={{ $env.LENDLOOP_CONVEX_SITE_URL + '/n8n/incidents' }}",
        sendHeaders: true,
        headerParameters: headerParams(),
        sendBody: true,
        contentType: "raw",
        rawContentType: "application/json",
        body: "={{ $json.body }}",
        options: { timeout: 15000 },
      },
      id: "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b",
      name: "Report incident",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [-40, 0],
      retryOnFail: true,
      maxTries: 3,
      waitBetweenTries: 5000,
    },
  ],
  connections: {
    "Error trigger": {
      main: [[{ node: "Sign incident", type: "main", index: 0 }]],
    },
    "Sign incident": {
      main: [[{ node: "Report incident", type: "main", index: 0 }]],
    },
  },
  settings: {
    executionOrder: "v1",
    saveManualExecutions: true,
  },
  staticData: null,
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};

const files = [
  ["request-notifications.json", notifications],
  ["daily-overdue-reminders.json", overdue],
  ["error-handler.json", errorHandler],
];

for (const [name, workflow] of files) {
  writeFileSync(join(OUT, name), `${JSON.stringify(workflow, null, 2)}\n`);
  console.log(`wrote workflows/${name}`);
}
