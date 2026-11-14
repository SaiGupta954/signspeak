// End-to-end tests: builds nothing, serves dist/ and drives the real app in Chrome.
// Usage: npm run build && npm run test:e2e
// Locally you can point to an installed Chrome with CHROME_PATH=/path/to/chrome.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4321;
const URL = `http://localhost:${PORT}/`;
const results = [];
let page;
let browser;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.log(`  ✗ ${name}\n      ${e.message.split('\n')[0]}`);
    await page?.screenshot({ path: `e2e/fail-${name.replace(/\W+/g, '-')}.png` }).catch(() => {});
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
async function waitFor(fn, ms = 10000, msg = 'timed out') {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await sleep(100);
  }
  throw new Error(msg);
}
const text = (sel) => page.locator(sel).innerText();
const count = (sel) => page.locator(sel).count();

async function freshPage(path = '', viewport = { width: 1280, height: 800 }) {
  await page?.close();
  page = await browser.newPage({ viewport });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(URL + path);
  await waitFor(async () => (await page.locator('[data-ready="yes"], .record').count()) > 0, 60000, 'app did not finish loading');
  if (!path) await waitFor(async () => (await page.locator('[data-ready="yes"]').count()) > 0, 60000, '3D signer did not load');
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
try {
  await sleep(2500);
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });

  console.log('SignSpeak end-to-end tests');
  await freshPage();

  await test('page loads with the signer and no errors', async () => {
    expect((await page.title()).includes('SignSpeak'), 'wrong title');
    expect((await count('canvas')) >= 2, '3D canvas or wave missing');
    expect(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
  });

  await test('typing a sentence signs it and shows the caption', async () => {
    await page.fill('.panel input', 'Hello Sam');
    await page.keyboard.press('Enter');
    await waitFor(async () => (await count('.caption span')) === 2, 3000, 'caption words missing');
    expect((await text('.caption')).replace(/\s+/g, ' ').trim() === 'HELLO SAM', 'caption text: ' + (await text('.caption')));
    expect((await page.inputValue('.panel input')) === '', 'input not cleared');
    expect((await text('.panel-row .hint')).includes('Signing'), 'status not "Signing"');
    await waitFor(async () => (await page.locator('.caption span.on').count()) === 1, 3000, 'no word highlighted');
  });

  await test('progress bar moves and the letter being spelled is highlighted', async () => {
    await waitFor(async () => (await count('.caption b.cur')) === 1, 20000, 'no highlighted letter while spelling SAM');
    const w = await page.locator('.track i').evaluate((e) => parseFloat(e.style.width));
    expect(w > 0, 'progress bar empty');
  });

  await test('✕ stops signing and clears the caption', async () => {
    await page.click('.close');
    expect((await count('.caption span')) === 0, 'caption not cleared');
    expect(!(await text('.panel-row .hint')).includes('Signing'), 'still signing');
  });

  await test('every menu opens, and clicking outside closes it', async () => {
    for (const m of ['View', 'Settings', 'Alphabet', 'History', 'Avatar', 'Help']) {
      await page.click(`.menu > button:text-is('${m}')`);
      expect((await count('.dropdown')) === 1, `${m} menu did not open`);
      await page.mouse.click(640, 300);
      expect((await count('.dropdown')) === 0, `${m} menu did not close`);
    }
  });

  await test('Settings: speed slider updates', async () => {
    await page.click(".menu > button:text-is('Settings')");
    await page.locator('.dropdown input[type=range]').fill('2');
    expect((await text('.dropdown .row b')).includes('2.0'), 'speed label not updated');
    await page.mouse.click(640, 300);
  });

  await test('Settings: turning word signs off fingerspells HELLO', async () => {
    await page.click(".menu > button:text-is('Settings')");
    await page.locator('.dropdown input[type=checkbox]').uncheck();
    await page.mouse.click(640, 300);
    await page.fill('.panel input', 'hello');
    await page.keyboard.press('Enter');
    await waitFor(async () => (await count('.caption b.cur')) === 1, 3000, 'HELLO was not spelled letter by letter');
    await page.click('.close');
    await page.click(".menu > button:text-is('Settings')");
    await page.locator('.dropdown input[type=checkbox]').check();
    await page.mouse.click(640, 300);
  });

  await test('Alphabet: tapping a letter signs it', async () => {
    await page.click(".menu > button:text-is('Alphabet')");
    expect((await count('.grid button')) === 36, 'expected 36 alphabet/number buttons');
    await page.click(".grid button:text-is('L')");
    await waitFor(async () => (await text('.caption')).trim() === 'L', 3000, 'L not signed');
    await page.mouse.click(640, 300);
    await page.click('.close');
  });

  await test('History: lists sentences, replays them, and clears', async () => {
    await page.click(".menu > button:text-is('History')");
    const items = await page.locator('.dropdown .item').allInnerTexts();
    expect(items.some((t) => t.includes('Hello Sam')) && items.some((t) => t.includes('hello')), 'history missing entries: ' + items.join(','));
    expect(!items.some((t) => t.trim() === '▶ L'), 'alphabet taps should not be saved to history');
    await page.click(".dropdown .item:has-text('Hello Sam')");
    await waitFor(async () => (await text('.caption')).includes('SAM'), 3000, 'replay did not start');
    await page.click('.close');
    await page.click(".menu > button:text-is('History')");
    await page.click(".dropdown .item:has-text('Clear history')");
    expect((await text('.dropdown')).includes('Nothing signed yet'), 'history not cleared');
    await page.mouse.click(640, 300);
  });

  await test('View: switching camera views', async () => {
    for (const v of ['Side angle', 'Hand close-up', 'Front']) {
      await page.click(".menu > button:text-is('View')");
      await page.click(`.dropdown .item:text-is('${v}')`);
      await page.click(".menu > button:text-is('View')");
      expect((await page.locator('.dropdown .item.checked').innerText()) === v, `${v} not selected`);
      await page.mouse.click(640, 300);
    }
  });

  await test('copy link shows a confirmation', async () => {
    await page.click('.icon[title="Copy link"]');
    await waitFor(async () => (await count('.toast')) === 1, 2000, 'no toast');
  });

  await test('mic button does not crash the page', async () => {
    await page.click('.mic');
    await sleep(800);
    await page.click('.mic').catch(() => {});
    expect(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
  });

  await test('Sign → Text: camera and hand tracking start', async () => {
    await page.click(".modes button:has-text('Sign → Text')");
    expect((await count('.cam')) === 1, 'camera box missing');
    expect((await count('.wave')) === 1 && !(await page.locator('.wave').isVisible()), 'wave should hide in camera mode');
    await waitFor(async () => (await count('.cam .fps')) === 1 || (await count('.cam-msg.err')) === 1, 45000, 'camera never became ready');
    expect((await count('.cam-msg.err')) === 0, 'camera error: ' + (await text('.cam').catch(() => '')));
    await waitFor(async () => parseInt(await text('.cam .fps')) > 0, 10000, 'hand tracking is not processing frames');
    console.log(`      (hand tracking ran at ${await text('.cam .fps')} in this headless test browser)`);
  });

  await test('Sign → Text: Space / ⌫ / Clear edit the text; Say it is disabled when empty', async () => {
    expect(await page.locator(".actions button:has-text('Say it')").isDisabled(), 'Say it should be disabled');
    await page.click(".actions button:text-is('Space')");
    await page.click(".actions button:text-is('Space')");
    await page.click(".actions button:text-is('⌫')");
    expect(await page.locator(".actions button:has-text('Sign it back')").isDisabled(), 'only spaces should not enable Sign it back');
    await page.click(".actions button:text-is('Clear')");
    expect((await text('.out')).includes('Fingerspell'), 'placeholder missing after clear');
  });

  await test('switching back to Speak turns the camera off', async () => {
    await page.click(".modes button:has-text('Speak → Sign')");
    expect((await count('.cam')) === 0, 'camera box still shown');
    expect((await count('.panel input')) === 1, 'message box missing');
    expect(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
  });

  await test('recording mode (#record) shows only the signer and auto-plays', async () => {
    await freshPage('#record');
    expect((await count('.record')) === 1, 'record view missing');
    expect((await count('.panel')) === 0 && (await count('.menubar')) === 0, 'UI should be hidden');
    await waitFor(async () => (await count('.record .letter')) === 1, 30000, 'phrase did not auto-play');
  });

  await test('recording mode accepts a custom phrase', async () => {
    await freshPage('#record=Zoo');
    await waitFor(async () => (await count('.record .letter')) === 1, 30000, 'custom phrase did not play');
    expect(['Z', 'O'].includes((await text('.record .letter')).trim()), 'unexpected letter');
  });

  await test('phone screen: controls fit without sideways scrolling', async () => {
    await freshPage('', { width: 375, height: 812 });
    const box = await page.locator('.panel').boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 375 && box.y + box.height <= 812, 'panel off screen');
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw <= 375, `page is ${sw}px wide`);
  });
} finally {
  await browser?.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
