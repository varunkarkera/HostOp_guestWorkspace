import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve("docs/screenshots");
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  await page.goto(process.env.CAPTURE_URL || "http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  await page.getByText("A thoughtful first draft", { exact: true }).waitFor();
  const screenshot = async (name: string) => {
    await page.locator("img").evaluateAll(async (images) => {
      await Promise.all(images.map((image) => image instanceof HTMLImageElement ? image.decode().catch(() => undefined) : undefined));
    });
    await page.screenshot({ path: resolve(directory, name), fullPage: true, animations: "disabled", style: "nextjs-portal { display: none !important; }" });
    console.log(`Saved ${name}`);
  };
  if (await page.evaluate(() => window.innerWidth) !== 1440) throw new Error("Desktop viewport mismatch");
  await screenshot("inbox-desktop.png");
  await page.getByRole("button", { name: "Properties", exact: true }).click();
  await screenshot("properties-desktop.png");
  await page.getByRole("button", { name: /Inbox 6/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /ET Emma Thompson/ }).click();
  await page.getByRole("button", { name: "Copy draft", exact: true }).waitFor({ state: "visible" });
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error("Mobile horizontal overflow");
  await screenshot("inbox-mobile.png");
} finally {
  await browser.close();
}