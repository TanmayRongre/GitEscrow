import http from "http";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function startServer(distPath: string): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url?.split("?")[0] || "/";
      if (reqPath === "/") reqPath = "/index.html";
      let filePath = path.join(distPath, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distPath, "index.html");
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

export async function captureViews(distPath: string, outputDir: string, prefix: string) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const { server, url } = await startServer(distPath);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Explore Bounties (/marketplace)
  await page.goto(`${url}/marketplace`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outputDir, `${prefix}-explore-bounties.png`) });
  console.log(`Captured ${prefix} Explore Bounties`);

  // 2. Dashboard (/dashboard)
  await page.goto(`${url}/dashboard`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outputDir, `${prefix}-dashboard.png`) });
  console.log(`Captured ${prefix} Dashboard`);

  // 3. Auth / Login (/auth)
  await page.goto(`${url}/auth`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outputDir, `${prefix}-login.png`) });
  console.log(`Captured ${prefix} Login`);

  await browser.close();
  server.close();
}

async function main() {
  const targetDist = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(process.cwd(), "client/dist");
  const prefix = process.argv[3] || "feat";
  const outputDir = path.resolve(process.cwd(), "artifacts/screens/regression");
  await captureViews(targetDist, outputDir, prefix);
}

main().catch(console.error);
