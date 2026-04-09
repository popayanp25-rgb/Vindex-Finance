const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
  });
  await page.goto('http://localhost:5178/login');
  await page.fill('input[type="email"]', 'Popayanp25@gmail.com');
  await page.fill('input[type="password"]', 'Adidasneo2003');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.click('text=Honorarios Fijos').catch(() => {});
  await page.waitForTimeout(2000);
  await browser.close();
})();
