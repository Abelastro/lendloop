import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClerkClient } from "@clerk/backend";

const outputDir = "docs/screenshots";
mkdirSync(outputDir, { recursive: true });

const users = JSON.parse(readFileSync("/tmp/lendloop-demo-users.json", "utf8"));
const admin = users.find((user) => user.name === "Avery Admin") ?? users[0];
const lender = users.find((user) => user.name === "Maya Chen") ?? users[1];
const borrower = users.find((user) => user.name === "Eli Rivera") ?? users[2];
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function signIn(context, user) {
  const ticket = await clerk.signInTokens.createSignInToken({
    userId: user.clerkId,
    expiresInSeconds: 600,
  });
  const page = await context.newPage();
  await page.goto(ticket.url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4_000);
  const dbJwt = (await context.cookies()).find(
    (cookie) => cookie.name === "__clerk_db_jwt",
  )?.value;
  if (!dbJwt) throw new Error("Clerk did not issue a dev browser token");

  const appUrl = new URL("http://localhost:3000/app");
  appUrl.searchParams.set("__clerk_db_jwt", dbJwt);
  await page.goto(appUrl.toString(), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("The board"), {
    timeout: 30_000,
  });
  await page.waitForTimeout(1_500);
  return page;
}

async function shot(page, name, options = {}) {
  await page.screenshot({ path: `${outputDir}/${name}.png`, ...options });
  console.log(`captured ${name}.png`);
}

const browser = await chromium.launch();

const publicContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const publicPage = await publicContext.newPage();
await publicPage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await publicPage.waitForTimeout(2_500);
await shot(publicPage, "landing", { fullPage: true });

await publicPage.goto("http://localhost:3000/#board", {
  waitUntil: "domcontentloaded",
});
await publicPage.waitForTimeout(2_000);
await shot(publicPage, "public-board");
await publicContext.close();

const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
});
const mobilePage = await mobileContext.newPage();
await mobilePage.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await mobilePage.waitForTimeout(2_500);
await shot(mobilePage, "landing-mobile", { fullPage: true });
await mobileContext.close();

const appContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const appPage = await signIn(appContext, admin);
await shot(appPage, "workspace-browse");

const requestButton = appPage
  .getByRole("button", { name: "Request", exact: true })
  .first();
if (await requestButton.count()) {
  await requestButton.click();
  await appPage.getByRole("dialog").waitFor({ timeout: 10_000 });
  await appPage.waitForTimeout(500);
  await shot(appPage, "request-dialog");
  await appPage.keyboard.press("Escape");
}

await appPage.goto("http://localhost:3000/app/incoming", {
  waitUntil: "domcontentloaded",
});
await appPage.waitForFunction(
  () => document.body.innerText.includes("Garden loppers"),
  { timeout: 30_000 },
);
await appPage.waitForTimeout(1_000);
await shot(appPage, "incoming-requests");

await appPage.goto("http://localhost:3000/app/admin", {
  waitUntil: "domcontentloaded",
});
await appPage.waitForFunction(
  () => document.body.innerText.includes("Automation incidents"),
  { timeout: 30_000 },
);
await appPage.waitForTimeout(1_000);
await shot(appPage, "admin-console");
await appContext.close();

const listingsContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const listingsPage = await signIn(listingsContext, lender);
await listingsPage.goto("http://localhost:3000/app/listings", {
  waitUntil: "domcontentloaded",
});
await listingsPage.waitForFunction(
  () => document.body.innerText.includes("Camp stove"),
  { timeout: 30_000 },
);
await listingsPage.waitForTimeout(1_000);
await shot(listingsPage, "my-listings");
await listingsContext.close();

const requestsContext = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const requestsPage = await signIn(requestsContext, borrower);
await requestsPage.goto("http://localhost:3000/app/requests", {
  waitUntil: "domcontentloaded",
});
await requestsPage.waitForFunction(
  () => document.body.innerText.includes("Cordless drill"),
  { timeout: 30_000 },
);
await requestsPage.waitForTimeout(1_000);
await shot(requestsPage, "my-requests");
await requestsContext.close();

await browser.close();
