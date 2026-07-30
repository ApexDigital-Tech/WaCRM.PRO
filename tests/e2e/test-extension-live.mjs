/**
 * test-extension-live.mjs
 * ─────────────────────────────────────────────────────────────
 * Carga la extensión compilada en Chrome real con Puppeteer,
 * captura logs crudos del Service Worker y del Content Script.
 *
 * Uso:
 *   node test-extension-live.mjs
 *
 * Requisitos:
 *   - La extensión debe estar compilada en apps/extension/dist/
 *   - Puppeteer instalado en tests/e2e/
 * ─────────────────────────────────────────────────────────────
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', '..', 'apps', 'extension', 'dist');

// Colores para output de consola
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(color, label, msg) {
  const ts = new Date().toISOString();
  console.log(`${color}[${ts}] [${label}]${RESET} ${msg}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  PULSO CRM — Extension E2E Live Test');
  console.log('  Extension path: ' + EXTENSION_PATH);
  console.log('═══════════════════════════════════════════════════════\n');

  // ─── 1. Launch Chrome with extension loaded ────────────────
  log(CYAN, 'SETUP', 'Lanzando Chrome con extensión cargada...');

  const tmpProfile = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'p_prof_' + Date.now() + '_' + Math.floor(Math.random()*1000));
  fs.mkdirSync(tmpProfile, { recursive: true });

  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    userDataDir: tmpProfile,
    args: [
      `--user-data-dir=${tmpProfile}`,
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
    ],
  });

  // Esperar a que Chrome registre la extensión
  await sleep(3000);

  // ─── 2. Encontrar el Service Worker ────────────────────────
  log(CYAN, 'SW', 'Buscando Service Worker de la extensión...');

  const targets = browser.targets();
  const swTarget = targets.find(
    t => t.type() === 'service_worker' && t.url().includes('serviceWorker')
  );

  const swLogs = [];

  if (swTarget) {
    log(GREEN, 'SW', 'Service Worker encontrado: ' + swTarget.url());

    // Conectarse al CDPSession del Service Worker
    const swCdp = await swTarget.createCDPSession();
    await swCdp.send('Runtime.enable');

    // Capturar TODOS los console.* del Service Worker
    swCdp.on('Runtime.consoleAPICalled', (event) => {
      const text = event.args.map(a => a.value ?? a.description ?? '').join(' ');
      const level = event.type; // 'log', 'info', 'warn', 'error'
      const line = `[SW ${level.toUpperCase()}] ${text}`;
      swLogs.push(line);
      log(YELLOW, 'SW-LOG', text);
    });

    // ─── 2a. Verificar chrome.alarms ─────────────────────────
    log(CYAN, 'SW', 'Consultando chrome.alarms.getAll() ...');

    const alarmsResult = await swCdp.send('Runtime.evaluate', {
      expression: `
        new Promise(resolve => {
          chrome.alarms.getAll(alarms => {
            resolve(JSON.stringify(alarms, null, 2));
          });
        });
      `,
      awaitPromise: true,
      returnByValue: true,
    });

    const alarmsOutput = alarmsResult.result.value;
    log(GREEN, 'SW-ALARMS', 'chrome.alarms.getAll() output:');
    console.log(alarmsOutput);
    swLogs.push('[SW-ALARMS] ' + alarmsOutput);

  } else {
    log(RED, 'SW', 'Service Worker NO encontrado. Targets disponibles:');
    for (const t of targets) {
      log(RED, 'TARGET', `type=${t.type()} url=${t.url()}`);
    }
  }

  // ─── 3. Navegar a WhatsApp Web y capturar Content Script ──
  log(CYAN, 'CS', 'Abriendo WhatsApp Web para capturar Content Script logs...');

  const csLogs = [];
  const page = await browser.newPage();

  // Interceptar TODOS los console.* de la página (Content Script incluido)
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('PULSO')) {
      const line = `[CS ${msg.type().toUpperCase()}] ${text}`;
      csLogs.push(line);
      log(YELLOW, 'CS-LOG', text);
    }
  });

  await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  log(GREEN, 'CS', 'Página cargada. Esperando logs iniciales del Content Script (5s)...');
  await sleep(5000);

  // ─── 4. Verificar Shadow DOM ──────────────────────────────
  log(CYAN, 'SHADOW', 'Verificando Shadow DOM (closed)...');

  const shadowCheck = await page.evaluate(() => {
    const host = document.getElementById('pulso-crm-host');
    if (!host) return { found: false, shadowRoot: 'N/A' };
    return {
      found: true,
      shadowRoot: host.shadowRoot === null ? 'null (CLOSED — correcto)' : 'accesible (OPEN — incorrecto)',
      tagName: host.tagName,
    };
  });

  log(
    shadowCheck.found ? GREEN : YELLOW,
    'SHADOW',
    `Host encontrado: ${shadowCheck.found}, shadowRoot: ${shadowCheck.shadowRoot}`
  );

  // ─── 5. Simular Offline y capturar Realtime logs ──────────
  log(CYAN, 'OFFLINE', 'Simulando Network Offline via CDP...');

  const cdp = await page.createCDPSession();
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });

  log(YELLOW, 'OFFLINE', 'Red deshabilitada. Esperando intentos de reconexión (15s)...');
  await sleep(15000);

  // Restaurar red
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  log(GREEN, 'ONLINE', 'Red restaurada. Esperando posible reconexión (5s)...');
  await sleep(5000);

  // ─── 6. Reporte final ─────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  REPORTE FINAL — Logs Crudos Capturados');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('── SERVICE WORKER LOGS (' + swLogs.length + ' entradas) ──');
  if (swLogs.length === 0) {
    console.log('  (sin logs capturados del SW)');
  } else {
    for (const l of swLogs) console.log('  ' + l);
  }

  console.log('\n── CONTENT SCRIPT LOGS (' + csLogs.length + ' entradas) ──');
  if (csLogs.length === 0) {
    console.log('  (sin logs con prefijo PULSO capturados del CS)');
  } else {
    for (const l of csLogs) console.log('  ' + l);
  }

  console.log('\n── SHADOW DOM CHECK ──');
  console.log('  Host encontrado: ' + shadowCheck.found);
  console.log('  shadowRoot: ' + shadowCheck.shadowRoot);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  FIN DEL TEST');
  console.log('═══════════════════════════════════════════════════════\n');

  await browser.close();
}

main().catch((err) => {
  console.error('Error fatal en test:', err);
  process.exit(1);
});
