#!/usr/bin/env node
/**
 * scripts/obfuscate.js
 * Obfuscates main.js and preload.js using javascript-obfuscator.
 * Writes output to obfuscated/ directory for electron-builder to pick up.
 *
 * Rules:
 *  - renameProperties: false (React/Next.js bundles break with property renaming)
 *  - selfDefending: false (breaks in Electron's V8 context due to strict source checks)
 *  - stringArrayEncoding: rc4 (good balance of obfuscation vs startup cost)
 *  - controlFlowFlattening: true on main.js/preload.js (safe — no framework code)
 */

const JavaScriptObfuscator = require('javascript-obfuscator')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'obfuscated')

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: false,          // keeps output deterministic; avoids size bloat
  debugProtection: false,            // breaks DevTools-less Electron main process
  disableConsoleOutput: false,       // keep console.log for process stdout/stderr
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,              // don't rename require, module, exports
  renameProperties: false,           // CRITICAL: React/Next.js breaks with this on
  selfDefending: false,              // CRITICAL: causes infinite loops in Electron
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 0.75,
  splitStrings: true,
  splitStringsChunkLength: 8,
  transformObjectKeys: false,        // false — property access patterns in Electron IPC must survive
  unicodeEscapeSequence: false,
  target: 'node',                    // electron main/preload run in Node, not browser
}

const TARGETS = [
  { src: path.join(ROOT, 'main.js'),    dst: path.join(OUT_DIR, 'main.js') },
  { src: path.join(ROOT, 'preload.js'), dst: path.join(OUT_DIR, 'preload.js') },
]

let hadError = false

for (const { src, dst } of TARGETS) {
  if (!fs.existsSync(src)) {
    console.error(`[obfuscate] Source not found: ${src}`)
    hadError = true
    continue
  }
  const source = fs.readFileSync(src, 'utf8')
  try {
    const result = JavaScriptObfuscator.obfuscate(source, OBFUSCATOR_OPTIONS)
    fs.writeFileSync(dst, result.getObfuscatedCode(), 'utf8')
    const origKB = Math.round(source.length / 1024)
    const outKB  = Math.round(result.getObfuscatedCode().length / 1024)
    console.log(`[obfuscate] ${path.basename(src)} → ${path.basename(dst)}  (${origKB}KB → ${outKB}KB)`)
  } catch (err) {
    console.error(`[obfuscate] Failed on ${src}: ${err.message}`)
    hadError = true
  }
}

if (hadError) {
  process.exit(1)
}
console.log('[obfuscate] Done. Output in obfuscated/')
