const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => {
    errors.push('PAGE_ERROR: ' + err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push('CONSOLE_ERROR: ' + msg.text());
    }
  });
  
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Budi Santoso'));
      if(btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    fs.writeFileSync('errors.txt', errors.join('\n'));
    console.log("Errors written to errors.txt");
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
