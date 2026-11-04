import http from "http";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CLIENT_DIST = path.resolve(process.cwd(), "client/dist");

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

function sRGBtoLin(c: number): number {
  c = c / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function getContrast(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
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

  const rawElements = await page.evaluate(`(() => {
    var canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });

    function colorToRgba(colorStr) {
      if (!colorStr || colorStr === "transparent") return [0, 0, 0, 0];
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      var imgData = ctx.getImageData(0, 0, 1, 1).data;
      return [imgData[0], imgData[1], imgData[2], imgData[3] / 255];
    }

    function blend(fg, bg) {
      var fgA = fg[3];
      var bgA = bg[3];
      var outA = fgA + bgA * (1 - fgA);
      if (outA === 0) return [0, 0, 0, 0];
      var r = Math.round((fg[0] * fgA + bg[0] * bgA * (1 - fgA)) / outA);
      var g = Math.round((fg[1] * fgA + bg[1] * bgA * (1 - fgA)) / outA);
      var b = Math.round((fg[2] * fgA + bg[2] * bgA * (1 - fgA)) / outA);
      return [r, g, b, outA];
    }

    function getEffectiveBg(el) {
      var cur = el;
      var layers = [];
      while (cur && cur !== document.documentElement) {
        var bg = window.getComputedStyle(cur).backgroundColor;
        if (bg && bg !== "transparent" && !bg.includes("rgba(0, 0, 0, 0)")) {
          var rgba = colorToRgba(bg);
          if (rgba[3] > 0) {
            layers.unshift(rgba);
            if (rgba[3] === 1) break;
          }
        }
        cur = cur.parentElement;
      }

      var isCream = !!el.closest(".home-section-cream, .home-section-cream-sunk");
      var base = isCream ? [251, 247, 239, 1] : [11, 12, 14, 1];

      for (var i = 0; i < layers.length; i++) {
        base = blend(layers[i], base);
      }
      return base;
    }

    var items = [];
    var seen = new Set();
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);

    while (walker.nextNode()) {
      var el = walker.currentNode;
      if (el.children.length === 0 && el.innerText && el.innerText.trim()) {
        var style = window.getComputedStyle(el);
        var text = el.innerText.trim();
        var fgRgba = colorToRgba(style.color);
        var bgRgb = getEffectiveBg(el);
        var sectionEl = el.closest("section, footer, header");
        var sectionId = sectionEl ? (sectionEl.id || sectionEl.tagName.toLowerCase()) : "root";

        var key = sectionId + "__" + style.fontSize + "__" + fgRgba.slice(0,3).join(",") + "__" + bgRgb.slice(0,3).join(",") + "__" + text.slice(0, 15);
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            text: text.slice(0, 40),
            tag: el.tagName.toLowerCase(),
            fg: [fgRgba[0], fgRgba[1], fgRgba[2]],
            bg: [bgRgb[0], bgRgb[1], bgRgb[2]],
            fontSize: style.fontSize,
            section: sectionId,
          });
        }
      }
    }
    return items;
  })()`);

  console.log("=== WCAG 2.1 AA Contrast Verification Table ===\n");
  console.log("| Section | Element / Text Sample | Size | Text RGB | Bg RGB | Ratio | Status |");
  console.log("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |");

  let failCount = 0;
  const results: any[] = [];

  for (const item of (rawElements as any[])) {
    const ratio = getContrast(item.fg, item.bg);
    const sizeNum = parseFloat(item.fontSize);
    const minRatio = sizeNum >= 24 ? 3.0 : 4.5;
    const isPass = ratio >= minRatio;

    if (!isPass) failCount++;

    results.push({
      ...item,
      ratio: ratio.toFixed(2),
      isPass,
    });

    console.log(
      `| ${item.section} | \`<${item.tag}>\` ${item.text.replace(/\|/g, "/")} | ${item.fontSize} | rgb(${item.fg.join(", ")}) | rgb(${item.bg.join(", ")}) | **${ratio.toFixed(2)}:1** | ${isPass ? "✓ PASS" : "❌ FAIL"} |`
    );
  }

  console.log(`\nTotal Text Pairs Evaluated: ${results.length}`);
  console.log(`Failing Pairs: ${failCount}`);

  if (failCount > 0) {
    console.log("\n=== DETAILS OF FAILING PAIRS ===");
    for (const item of results.filter(r => !r.isPass)) {
      console.log(`FAIL: [${item.section}] <${item.tag}> "${item.text}" (${item.fontSize}) -> Ratio: ${item.ratio}:1 (Expected: ${parseFloat(item.fontSize) >= 24 ? 3.0 : 4.5}:1) | Text: rgb(${item.fg.join(",")}) | Bg: rgb(${item.bg.join(",")})`);
    }
  }

  await browser.close();
  server.close();
}

main().catch(console.error);
