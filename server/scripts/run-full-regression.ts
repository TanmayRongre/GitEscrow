import http from "http";
import fs from "fs";
import path from "path";
import cp from "child_process";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const WORKSPACE_DIR = process.cwd();
const REG_DIR = path.resolve(WORKSPACE_DIR, "artifacts/screens/regression");
const ARTIFACT_MIRROR = process.env.ARTIFACT_MIRROR || REG_DIR;
const DIST_MAIN = path.resolve(WORKSPACE_DIR, "artifacts/dist-main");

if (!fs.existsSync(REG_DIR)) fs.mkdirSync(REG_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_MIRROR)) fs.mkdirSync(ARTIFACT_MIRROR, { recursive: true });

// Mock Data
const mockUser = {
  _id: "6726201a4f00123456789abc",
  id: "6726201a4f00123456789abc",
  name: "Alex Rivera",
  displayName: "Alex Rivera (Lead Maintainer)",
  username: "alexdev",
  email: "alex.rivera@example.com",
  role: "ADMIN",
  accountStatus: "ACTIVE",
  reputationScore: 100,
  paypalEmail: "alex.rivera@sandbox.example.com",
  organizations: [{ organizationId: "6726201a4f00123456789def", name: "React Core Team", role: "OWNER" }],
};

const mockSummary = {
  totalActive: 6,
  totalSponsored: 3,
  totalReviewsAwaiting: 2,
  totalEscrowFundedCents: 185000,
  totalEscrowDisbursedCents: 65000,
};

const mockBounties = [
  {
    _id: "6726201a4f00123456789b01",
    id: "6726201a4f00123456789b01",
    title: "[Fizz] Use the script nonce for bootstrap script preloads",
    description: "Support Content Security Policy nonce forwarding for script preloads in the Fizz streaming runtime.",
    rewardAmount: 250,
    totalAmount: 250,
    totalAmountCents: 25000,
    fundedAmountCents: 25000,
    disbursedAmountCents: 15000,
    fundingStatus: "FUNDED",
    status: "IN_PROGRESS",
    currency: "USD",
    repository: { owner: "facebook", name: "react" },
    repositoryOwner: "facebook",
    repositoryName: "react",
    repositoryFullName: "facebook/react",
    repositoryUrl: "https://github.com/facebook/react",
    repositoryId: 10279,
    issueNumber: 38090,
    issueTitle: "[Fizz] Use the script nonce for bootstrap script preloads",
    issueUrl: "https://github.com/facebook/react/issues/38090",
    issueState: "open",
    issueLabels: ["Component: Fizz", "Type: Security / CSP", "Good First Milestone"],
    assignedContributorId: { _id: "6726201a4f00123456789contrib", name: "Elena Rostova", username: "elenarostova" },
    createdBy: { _id: "6726201a4f00123456789abc", name: "Alex Rivera", username: "alexdev" },
    organizationId: { _id: "6726201a4f00123456789def", name: "React Core Team", slug: "react-core-team" },
    createdAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-03T12:00:00.000Z",
    milestones: [],
  },
  {
    _id: "6726201a4f00123456789b02",
    id: "6726201a4f00123456789b02",
    title: "Add container query unit support in arbitrary variants",
    description: "Support unit suffixes (e.g., @sm/w-[30cqw]) in custom arbitrary variants.",
    rewardAmount: 180,
    totalAmount: 180,
    totalAmountCents: 18000,
    fundedAmountCents: 18000,
    disbursedAmountCents: 0,
    fundingStatus: "FUNDED",
    status: "OPEN",
    currency: "USD",
    repository: { owner: "tailwindlabs", name: "tailwindcss" },
    repositoryOwner: "tailwindlabs",
    repositoryName: "tailwindcss",
    repositoryFullName: "tailwindlabs/tailwindcss",
    repositoryUrl: "https://github.com/tailwindlabs/tailwindcss",
    repositoryId: 28941,
    issueNumber: 13400,
    issueTitle: "Add container query unit support in arbitrary variants",
    issueUrl: "https://github.com/tailwindlabs/tailwindcss/issues/13400",
    issueState: "open",
    issueLabels: ["CSS", "Engine", "Syntax"],
    createdBy: { _id: "6726201a4f00123456789abc", name: "Alex Rivera", username: "alexdev" },
    organizationId: { _id: "6726201a4f00123456789def", name: "React Core Team", slug: "react-core-team" },
    createdAt: "2026-11-01T16:00:00.000Z",
    updatedAt: "2026-11-01T16:00:00.000Z",
    milestones: [],
  },
];

function startAppServer(distPath: string, isAuth = true): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url?.split("?")[0] || "/";

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // API mocks
      if (reqPath.startsWith("/api/auth/me")) {
        if (isAuth) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ user: mockUser }));
        } else {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
        }
        return;
      }

      if (reqPath.startsWith("/api/bounties/summary")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(mockSummary));
        return;
      }

      if (reqPath.startsWith("/api/bounties")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ bounties: mockBounties, total: mockBounties.length }));
        return;
      }

      if (reqPath.startsWith("/api/organizations")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ organizations: mockUser.organizations }));
        return;
      }

      if (reqPath.startsWith("/api/users/me/payout-profile")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ payoutProfile: { payoutStatus: "VERIFIED" } }));
        return;
      }

      if (reqPath.includes("/ledger")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ events: [] }));
        return;
      }

      // Static files
      if (reqPath === "/") reqPath = "/index.html";
      let filePath = path.join(distPath, reqPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distPath, "index.html");
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentTypes: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".otf": "font/otf",
        ".ttf": "font/ttf",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
      };

      const contentType = contentTypes[ext] || "application/octet-stream";
      try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as any;
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function buildMainDist() {
  if (fs.existsSync(DIST_MAIN)) {
    console.log("Using existing artifacts/dist-main");
    return;
  }
  console.log("Building main branch into artifacts/dist-main...");
  const tempDir = path.resolve(WORKSPACE_DIR, "../temp-main-build");
  try {
    cp.execSync(`git worktree add "${tempDir}" main`, { stdio: "inherit" });
    // create junctions for node_modules
    cp.execSync(`cmd /c mklink /J "${path.join(tempDir, "client/node_modules")}" "${path.join(WORKSPACE_DIR, "client/node_modules")}"`, { stdio: "inherit" });
    cp.execSync(`cmd /c mklink /J "${path.join(tempDir, "node_modules")}" "${path.join(WORKSPACE_DIR, "node_modules")}"`, { stdio: "inherit" });
    
    // build to DIST_MAIN
    cp.execSync(`npm run build --prefix "${path.join(tempDir, "client")}"`, { stdio: "inherit" });
    
    // copy dist to DIST_MAIN
    if (!fs.existsSync(DIST_MAIN)) fs.mkdirSync(DIST_MAIN, { recursive: true });
    cp.execSync(`xcopy /E /I /Y "${path.join(tempDir, "client/dist")}" "${DIST_MAIN}"`, { stdio: "inherit" });
  } finally {
    try { cp.execSync(`cmd /c rmdir "${path.join(tempDir, "client/node_modules")}"`); } catch {}
    try { cp.execSync(`cmd /c rmdir "${path.join(tempDir, "node_modules")}"`); } catch {}
    try { cp.execSync(`git worktree remove "${tempDir}" --force`); } catch {}
  }
}

async function captureBranchViews(distPath: string, prefix: string) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Authenticated session (Explore Bounties & Dashboard)
  const { server: authServer, url: authUrl } = await startAppServer(distPath, true);

  await page.goto(authUrl, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 600));

  // Navigate to Explore Bounties (Marketplace)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    const b = btns.find((x) => x.textContent?.trim().includes("Explore Bounties") || x.textContent?.trim() === "Marketplace");
    if (b) (b as HTMLElement).click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(REG_DIR, `${prefix}-explore-bounties.png`) });
  console.log(`Captured ${prefix} Explore Bounties`);

  // Navigate to Dashboard
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    const b = btns.find((x) => x.textContent?.trim() === "Dashboard");
    if (b) (b as HTMLElement).click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(REG_DIR, `${prefix}-dashboard.png`) });
  console.log(`Captured ${prefix} Dashboard`);

  authServer.close();

  // 2. Unauthenticated session (Login page)
  const { server: anonServer, url: anonUrl } = await startAppServer(distPath, false);

  await page.goto(anonUrl, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 600));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    const b = btns.find((x) => x.textContent?.trim() === "Login" || x.textContent?.trim() === "Sign in");
    if (b) (b as HTMLElement).click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(REG_DIR, `${prefix}-login.png`) });
  console.log(`Captured ${prefix} Login`);

  anonServer.close();
  await browser.close();
}

async function generateSideBySide() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const pairs = [
    { name: "explore-bounties", title: "Explore Bounties (/marketplace)" },
    { name: "dashboard", title: "Fintech Dashboard (/dashboard)" },
    { name: "login", title: "Login & Authentication (/auth)" },
  ];

  for (const pair of pairs) {
    const mainImgPath = path.join(REG_DIR, `main-${pair.name}.png`);
    const featImgPath = path.join(REG_DIR, `feat-${pair.name}.png`);

    const mainBase64 = fs.readFileSync(mainImgPath).toString("base64");
    const featBase64 = fs.readFileSync(featImgPath).toString("base64");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            margin: 0;
            padding: 32px;
            background: #0B0C0E;
            color: #F4F5F6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 24px;
            font-weight: 600;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
          }
          .col {
            background: #14171B;
            border: 1px solid #20242A;
            border-radius: 8px;
            overflow: hidden;
          }
          .col-header {
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 600;
            background: #1B1F24;
            border-bottom: 1px solid #20242A;
            display: flex;
            justify-content: space-between;
          }
          .badge {
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 4px;
          }
          .badge-main { background: rgba(255, 255, 255, 0.1); color: #CBD5E1; }
          .badge-feat { background: rgba(217, 119, 6, 0.2); color: #F59E0B; }
          img {
            width: 100%;
            display: block;
          }
        </style>
      </head>
      <body>
        <h1>Regression Comparison: ${pair.title}</h1>
        <div class="grid">
          <div class="col">
            <div class="col-header">
              <span>Main Branch</span>
              <span class="badge badge-main">Before Rebuild</span>
            </div>
            <img src="data:image/png;base64,${mainBase64}">
          </div>
          <div class="col">
            <div class="col-header">
              <span>feat/rebuild-home-page</span>
              <span class="badge badge-feat">Current (With Home Rebuild)</span>
            </div>
            <img src="data:image/png;base64,${featBase64}">
          </div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: "load" });
    await new Promise((r) => setTimeout(r, 600));

    const outPath = path.join(REG_DIR, `side-by-side-${pair.name}.png`);
    await page.screenshot({ path: outPath, fullPage: true });

    // Copy to artifact mirror
    fs.copyFileSync(outPath, path.join(ARTIFACT_MIRROR, `side-by-side-${pair.name}.png`));
    fs.copyFileSync(mainImgPath, path.join(ARTIFACT_MIRROR, `main-${pair.name}.png`));
    fs.copyFileSync(featImgPath, path.join(ARTIFACT_MIRROR, `feat-${pair.name}.png`));

    console.log(`Generated side-by-side comparison for ${pair.name}`);
  }

  await browser.close();
}

async function main() {
  await buildMainDist();
  console.log("Capturing views for feat branch...");
  await captureBranchViews(path.resolve(WORKSPACE_DIR, "client/dist"), "feat");
  console.log("Capturing views for main branch...");
  await captureBranchViews(DIST_MAIN, "main");
  console.log("Generating side-by-side images...");
  await generateSideBySide();
  console.log("Regression comparison complete!");
}

main().catch(console.error);

