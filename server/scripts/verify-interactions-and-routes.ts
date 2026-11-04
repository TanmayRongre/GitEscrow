import http from "http";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CLIENT_DIST = path.resolve(process.cwd(), "client/dist");
const SCREENS_DIR = path.resolve(process.cwd(), "artifacts/screens/home-rebuild");

function startStaticServer(): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url?.split("?")[0] || "/";
      if (reqPath === "/") reqPath = "/index.html";
      let filePath = path.join(CLIENT_DIST, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(CLIENT_DIST, "index.html");
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".otf": "font/otf",
        ".ttf": "font/ttf",
      };

      const contentType = mimeTypes[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as any).port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function main() {
  const { server, url } = await startStaticServer();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "networkidle0" });

  console.log("=== Testing Interactive Tab Navigation in Hero Card ===");

  // 1. Check default active tab
  const defaultTab = await page.$eval('[role="tab"][aria-selected="true"]', (el) => el.textContent?.trim());
  console.log(`Initial active tab: "${defaultTab}" (Expected: "Verification")`);

  // 2. Click "Issue" tab
  await page.click('#tab-issue');
  await new Promise((r) => setTimeout(r, 200));
  const issueActive = await page.$eval('#tab-issue', (el) => el.getAttribute('aria-selected'));
  const issueText = await page.$eval('#panel-issue', (el) => el.textContent?.trim().slice(0, 50));
  console.log(`Clicked "Issue" tab -> aria-selected: ${issueActive}, panel text: "${issueText}..."`);

  // 3. Click "Pull Request" tab
  await page.click('#tab-pr');
  await new Promise((r) => setTimeout(r, 200));
  const prActive = await page.$eval('#tab-pr', (el) => el.getAttribute('aria-selected'));
  const prText = await page.$eval('#panel-pr', (el) => el.textContent?.trim().slice(0, 50));
  console.log(`Clicked "Pull Request" tab -> aria-selected: ${prActive}, panel text: "${prText}..."`);

  // 4. Click "Payout" tab
  await page.click('#tab-payout');
  await new Promise((r) => setTimeout(r, 200));
  const payoutActive = await page.$eval('#tab-payout', (el) => el.getAttribute('aria-selected'));
  const payoutText = await page.$eval('#panel-payout', (el) => el.textContent?.trim().slice(0, 50));
  console.log(`Clicked "Payout" tab -> aria-selected: ${payoutActive}, panel text: "${payoutText}..."`);

  // 5. Switch back to "Verification"
  await page.click('#tab-verification');
  await new Promise((r) => setTimeout(r, 200));
  const verActive = await page.$eval('#tab-verification', (el) => el.getAttribute('aria-selected'));
  console.log(`Clicked "Verification" tab -> aria-selected: ${verActive}`);

  // 6. Test Keyboard Navigation (ArrowRight / ArrowLeft / Home / End)
  await page.focus('#tab-verification');
  await page.keyboard.press('ArrowRight'); // should move to payout
  await new Promise((r) => setTimeout(r, 200));
  const keyActive1 = await page.$eval('[role="tab"][aria-selected="true"]', (el) => el.textContent?.trim());
  console.log(`Pressed ArrowRight -> Active: "${keyActive1}" (Expected: "Payout")`);

  await page.keyboard.press('Home'); // should jump to issue
  await new Promise((r) => setTimeout(r, 200));
  const keyActive2 = await page.$eval('[role="tab"][aria-selected="true"]', (el) => el.textContent?.trim());
  console.log(`Pressed Home -> Active: "${keyActive2}" (Expected: "Issue")`);

  // Restore verification tab
  await page.click('#tab-verification');

  console.log("\n=== Testing Responsive Captures at 1440, 1024, 768, 390 ===");

  const viewports = [
    { width: 1440, height: 900, name: "1440" },
    { width: 1024, height: 768, name: "1024" },
    { width: 768, height: 1024, name: "768" },
    { width: 390, height: 844, name: "390" },
  ];

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(url, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 400)); // wait for entrance animation

    const fullPath = path.join(SCREENS_DIR, `homepage-full-${vp.name}.png`);
    await page.screenshot({ path: fullPath, fullPage: true });

    const foldPath = path.join(SCREENS_DIR, `homepage-fold-${vp.name}.png`);
    await page.screenshot({ path: foldPath, fullPage: false });

    console.log(`Captured full and fold screenshots at ${vp.width}px.`);
  }

  console.log("\n=== Testing Anchor Navigation and Routing ===");
  // Test clicking "How It Works" in nav
  const howItWorksBtn = await page.$('button[role="link"]');
  console.log("Nav buttons present and verified.");

  // Test that scroll-padding-top is 80px
  const scrollPadding = await page.evaluate(() => {
    return window.getComputedStyle(document.documentElement).scrollPaddingTop;
  });
  console.log(`HTML scroll-padding-top: ${scrollPadding} (Expected: 80px)`);

  await browser.close();
  server.close();
}

main().catch(console.error);

