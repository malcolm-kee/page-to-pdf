import { json } from 'body-parser';
import { config } from 'dotenv';
import express from 'express';
import LruCache from 'lru-cache';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sanitize from 'sanitize-filename';

config();

let id = 0;

async function screenshot(url: string) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url);
  const pdfPath = path.resolve(__dirname, `shot/${sanitize(url)}${id++}.pdf`);
  await page.pdf({ path: pdfPath });
  await browser.close();

  return pdfPath;
}

const cache = new LruCache<string, string>({
  ttl: 1000 * 60 * 5, // 5 minutes,
  max: 100,
  fetchMethod: async (url) => {
    const filePath = await screenshot(url);
    return filePath;
  },
  dispose: (value) => {
    console.log('disposing');
    fs.unlink(value, () => console.log(`Removed file ${value}`));
  },
});

const app = express();
app.use(json());

app.get('/', (_, res) => res.json({ OK: true }));

app.post('/screenshot', (req, res) => {
  const url = req.body?.url;
  const key = req.body?.key;

  if (
    !url ||
    typeof url !== 'string' ||
    typeof key !== 'string' ||
    key.trim() !== process.env.API_KEY
  ) {
    return res.status(403).json({ message: 'Not supported' });
  }

  cache.fetch(url).then((pdfPath) => {
    const stream = fs.createReadStream(pdfPath);
    const stat = fs.statSync(pdfPath);

    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/pdf');

    stream.pipe(res);
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`App started at http://localhost:${port}`));
