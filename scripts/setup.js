// scripts/setup.js
// Cross‑platform setup script for AMARKETING audit platform
// Generates .env.local from .env.example, creates secrets, data folder, runs migrations,
// and prints a checklist of missing required variables.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const envExamplePath = path.join(projectRoot, '.env.example');
const envLocalPath = path.join(projectRoot, '.env.local');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key] = rest.join('=');
  }
  return env;
}

function writeEnvFile(filePath, env) {
  const content = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  fs.writeFileSync(filePath, content + '\n', { encoding: 'utf-8' });
}

function generateSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function ensureDataFolder() {
  const dataDir = path.join(projectRoot, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data folder:', dataDir);
  }
}

function runMigrations() {
  try {
    console.log('Running database migrations...');
    execSync('npm run db:migrate', { stdio: 'inherit', cwd: projectRoot });
    console.log('Migrations completed.');
  } catch (e) {
    console.error('Migration step failed.');
  }
}

function printChecklist(env) {
  const required = [
    'GEMINI_API_KEY',
    'ADMIN_PASSWORD',
    'ADMIN_SESSION_SECRET',
    'CRON_SECRET',
    'NEXT_PUBLIC_APP_URL',
  ];
  console.log('\n=== Setup Checklist ===');
  required.forEach((key) => {
    if (!env[key] || env[key].trim() === '') {
      console.log(`Missing: ${key}`);
    }
  });
  console.log('You can now run: npm run dev');
}

// Main execution
if (!fs.existsSync(envExamplePath)) {
  console.error('.env.example not found at', envExamplePath);
  process.exit(1);
}

let env = loadEnvFile(envLocalPath);
if (!Object.keys(env).length) {
  // copy from example
  const exampleEnv = loadEnvFile(envExamplePath);
  env = { ...exampleEnv };
  console.log('Created .env.local from .env.example');
}

// Generate secrets if empty
if (!env['ADMIN_SESSION_SECRET'] || env['ADMIN_SESSION_SECRET'].trim() === '') {
  env['ADMIN_SESSION_SECRET'] = generateSecret(32);
  console.log('Generated ADMIN_SESSION_SECRET');
}
if (!env['CRON_SECRET'] || env['CRON_SECRET'].trim() === '') {
  env['CRON_SECRET'] = generateSecret(24);
  console.log('Generated CRON_SECRET');
}

// Development admin password generation (only if empty)
if (!env['ADMIN_PASSWORD'] || env['ADMIN_PASSWORD'].trim() === '') {
  const devPassword = 'admin123'; // simple dev password
  env['ADMIN_PASSWORD'] = devPassword;
  console.log('Generated development ADMIN_PASSWORD (dev only):', devPassword);
}

writeEnvFile(envLocalPath, env);
ensureDataFolder();
runMigrations();
printChecklist(env);

