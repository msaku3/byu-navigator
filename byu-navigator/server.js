// Node 22+; uses built-in HTTP and fetch, so no npm dependencies are needed.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;
const majorIdColumn = process.env.MAJOR_ID_COLUMN || 'majorid';
if (!base || !key || /YOUR_/.test(base + key)) {
  console.error('Fill in SUPABASE_URL and SUPABASE_KEY in .env before starting.');
  process.exit(1);
}
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(majorIdColumn)) throw new Error('Invalid MAJOR_ID_COLUMN.');
const upstream = new URL(base);
if (upstream.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(upstream.hostname)) throw new Error('Use an HTTPS Supabase URL.');
// This prototype deliberately uses a publishable/anon key and preserves RLS checks.
let role;
try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
if (key.startsWith('sb_secret_') || role === 'service_role') {
  console.error('Use a publishable or legacy anon key for this prototype, not a secret/service_role key.');
  process.exit(1);
}
async function db(table, query, row) {
  const url = new URL('/rest/v1/' + table, upstream);
  url.search = new URLSearchParams(query).toString();
  const headers = {apikey: key, 'Content-Type': 'application/json'};
  if (!key.startsWith('sb_publishable_')) headers.Authorization = 'Bearer ' + key;
  if (row) headers.Prefer = table === 'major' ? 'return=representation' : 'return=minimal';
  const r = await fetch(url, {method: row ? 'POST' : 'GET', headers, body: row ? JSON.stringify(row) : undefined, signal: AbortSignal.timeout(15000)});
  if (!r.ok) {
    const info = await r.json().catch(() => ({}));
    const error = new Error(info.code === '42501' ? 'Supabase denied this request. Check your table permissions and RLS policies.' : info.code === '23505' ? 'A record with that value already exists. Check the NetID or major.' : 'Database request failed. Check your Supabase settings and table columns.');
    error.status = info.code === '23505' ? 409 : 502;
    throw error;
  }
  return r.status === 204 ? null : r.json();
}
async function createAuthAccount(email, password) {
  const url = new URL('/auth/v1/signup', upstream);

  const headers = {
    apikey: key,
    'Content-Type': 'application/json'
  };

  // Legacy anon keys use this extra header.
  if (!key.startsWith('sb_publishable_')) {
    headers.Authorization = 'Bearer ' + key;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    let message = 'Could not create the account. Check your Auth settings.';

    if (response.status === 429) {
      message = 'Too many attempts. Please wait before trying again.';
    } else if (result.error_code === 'email_address_not_authorized') {
      message = 'Email delivery is not configured for this address.';
    } else if (result.error_code === 'weak_password') {
      message = 'Choose a stronger password.';
    }

    const error = new Error(message);
    error.status = response.status === 429 ? 429 : 400;
    throw error;
  }

  return result;
}
function json(res, status, value) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(JSON.stringify(value));
}
async function body(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 8192) throw Object.assign(new Error('Request is too large.'), {status:413});
  }
  try { return JSON.parse(data); }
  catch { throw Object.assign(new Error('Send valid JSON.'), {status:400}); }
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = await fs.readFile(path.join(__dirname, 'public/index.html'));
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'X-Content-Type-Options':'nosniff'});
      return res.end(html);
    }
    if (req.method === 'GET' && url.pathname === '/api/majors') {
      const rows = await db('major', {select:majorIdColumn + ',majorname', order:'majorname'});
      return json(res, 200, rows.map(row => ({id: row[majorIdColumn], majorname: row.majorname})));
    }
    if (req.method === 'POST' && url.pathname === '/api/students') {
      // Reject browser requests from a different origin; no CORS access is enabled.
      if (req.headers.origin && req.headers.origin !== 'http://' + req.headers.host) return json(res, 403, {error:'Submit this form from the Navigator website.'});
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, {error:'Send JSON.'});
      const input = await body(req);
      if (!input || typeof input !== 'object' || Array.isArray(input)) return json(res,400,{error:'Invalid form data.'});
      for (const field of ['first','last','net','nat','major']) {
        if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length > 120) return json(res,400,{error:'Complete every field (maximum 120 characters each).'});
        input[field] = input[field].trim();
      }
      if (!/^[A-Za-z0-9]{4,12}$/.test(input.net)) return json(res,400,{error:'NetID must be 4–12 letters or numbers.'});
      const majors = await db('major', {select:majorIdColumn + ',majorname'});
      let major = majors.find(row => row.majorname.trim().toLowerCase() === input.major.toLowerCase());
      if (!major) {
        const rows = await db('major', {select:majorIdColumn + ',majorname'}, {majorname:input.major, department:''});
        major = rows[0];
      }
      await db('student', {}, {netid:input.net, firstname:input.first, lastname:input.last, nationality:input.nat, majorid:major[majorIdColumn]});
      return json(res,201,{major:major.majorname});
    }
    json(res,404,{error:'Page not found.'});
  } catch (error) {
    json(res,error.status || 502,{error:error.status ? error.message : 'Could not connect to Supabase. Check the URL, key, and internet connection.'});
  }
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Navigator running at http://localhost:' + server.address().port));
