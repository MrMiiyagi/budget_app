import fs from 'node:fs'
import path from 'node:path'

function loadDotEnv(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const projectRoot = process.cwd()
const env = {
  ...loadDotEnv(path.join(projectRoot, '.env')),
  ...process.env,
}

const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.error('Fehlende Env Variablen. Bitte setze VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

async function ping(name, endpoint) {
  const res = await fetch(endpoint, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
  })
  const text = await res.text().catch(() => '')
  return { name, status: res.status, ok: res.ok, bodyPreview: text.slice(0, 180) }
}

const base = url.replace(/\/$/, '')
const results = []

// REST ping against a known table path. With RLS it may return 401/403 for anon,
// which still proves connectivity + correct project URL.
try {
  results.push(await ping('rest expenses (select)', `${base}/rest/v1/expenses?select=id&limit=1`))
} catch (e) {
  results.push({ name: 'rest expenses (select)', status: 0, ok: false, bodyPreview: String(e) })
}

// A very lightweight endpoint that should exist on most projects; if not, ignore.
try {
  results.push(await ping('auth settings (options)', `${base}/auth/v1/settings`))
} catch (e) {
  results.push({ name: 'auth settings (options)', status: 0, ok: false, bodyPreview: String(e) })
}

for (const r of results) {
  const flag = r.ok ? 'OK' : 'FAIL'
  console.log(`${flag} - ${r.name}: HTTP ${r.status}`)
  if (!r.ok) console.log(`  Antwort (Preview): ${r.bodyPreview}`)
}

const anyUseful =
  results.some((r) => r.ok) ||
  results.some((r) => r.status === 401 || r.status === 403) // expected when RLS denies anon
process.exit(anyUseful ? 0 : 2)

