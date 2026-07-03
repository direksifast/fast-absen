const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE_ERROR: ' + msg.text()); });
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Masuk sebagai Karyawan'));
    if (btn) btn.click();
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Budi Santoso'));
    if(btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Masuk');
    if (btn) btn.click();
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  fs.writeFileSync('errors.txt', errors.join('\n'));
  const html = await page.evaluate(() => document.body.innerHTML);
  fs.writeFileSync('html.txt', html);
  
  await browser.close();
})();
