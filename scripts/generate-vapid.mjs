import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const vapidKeys = webpush.generateVAPIDKeys();

console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);

const keysPath = path.join(__dirname, '../src/utils/vapidKeys.json');
fs.writeFileSync(keysPath, JSON.stringify(vapidKeys, null, 2));

console.log('Saved VAPID keys to src/utils/vapidKeys.json');
