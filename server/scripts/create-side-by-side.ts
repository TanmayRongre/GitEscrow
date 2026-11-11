import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const REG_DIR = path.resolve(process.cwd(), "artifacts/screens/regression");
const ARTIFACT_MIRROR = process.env.ARTIFACT_MIRROR || REG_DIR;

const pairs = [
  { name: "explore-bounties", title: "Explore Bounties (/marketplace)" },
  { name: "dashboard", title: "Dashboard (/dashboard)" },
  { name: "login", title: "Login & Register (/auth)" },
];

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

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
    console.log(`Created side-by-side comparison for ${pair.name}`);
  }

  await browser.close();
}

main().catch(console.error);
