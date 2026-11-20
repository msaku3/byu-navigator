// Server only: never put SUPABASE_SERVICE_ROLE_KEY into frontend code.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROFILE = 'studentid,auth_user_id,netid,firstname,lastname,nationality,majorid,current_stage';
class Problem extends Error { constructor(status, message) { super(message); this.status = status; } }
export function createHandler({env = process.env, fetcher = fetch} = {}) {
  return async function handle(request) {
    const reply = (status, data) => Response.json(data, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    try {
      const url = new URL(request.url), method = request.method;
      if (!['GET','POST','PATCH','DELETE'].includes(method)) return reply(405,{error:'Method not allowed.'});
      // Browser mutations must come from this website; no cross-origin CORS is enabled.
      if (method !== 'GET' && request.headers.get('origin') !== url.origin) throw new Problem(403,'Submit changes from the Navigator website.');
      const token = request.headers.get('authorization');
      if (!/^Bearer \S+$/i.test(token || '')) throw new Problem(401,'Sign in again.');
      const base = env.SUPABASE_URL, publicKey = env.SUPABASE_KEY;
      if (!base || !publicKey) throw new Problem(503,'Server configuration is incomplete.');
      async function upstream(path, {method='GET',body,key=publicKey,bearer=token,prefer}={}) {
        const headers = {apikey:key,'Content-Type':'application/json'};
        if (bearer) headers.Authorization = bearer;
        if (prefer) headers.Prefer = prefer;
        const res = await fetcher(new URL(path,base),{method,headers,body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(15000)});
        const data = await res.json().catch(()=>null);
        if (!res.ok) {
          if (res.status === 401) throw new Problem(401,'Your sign-in expired. Sign in again.');
          if (data?.code === '23505' || data?.error_code === 'email_exists') throw new Problem(409,'That email or NetID is already in use.');
          if (data?.code === '23503') throw new Problem(409,'Related records prevent deletion. Check that migration 02 was applied. Admin accounts are protected.');
          throw new Problem(res.status >= 500 ? 502 : 400, 'Supabase rejected this change. Check the supplied values and server configuration.');
        }
        return data;
      }
      // Verify the live identity, then check the protected role using that user's JWT.
      const identity = await upstream('/auth/v1/user');
      if (!identity?.id) throw new Problem(401,'Sign in again.');
      const membership = await upstream('/rest/v1/admin_users?select=auth_user_id&auth_user_id=eq.'+encodeURIComponent(identity.id));
      if (!membership?.length) throw new Problem(403,'Administrator access is required.');
      const secret = env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret) throw new Problem(503,'The administrator server key has not been configured.');
      let secretRole;
      try { secretRole = JSON.parse(Buffer.from(secret.split('.')[1],'base64url').toString()).role; } catch {}
      if (!secret.startsWith('sb_secret_') && secretRole !== 'service_role') throw new Problem(503,'Configure a server-only Supabase secret or service-role key.');
      // New secret keys use apikey; legacy service-role JWTs also use Authorization.
      const privileged = (path, options={}) => upstream(path,{...options,key:secret,bearer:secret.startsWith('sb_secret_') ? null : 'Bearer '+secret});
      if (method === 'GET') {
        const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1));
        if (!Number.isInteger(page)) throw new Problem(400,'Invalid page.');
        const listing = await privileged('/auth/v1/admin/users?page='+page+'&per_page=25');
        const accounts = listing?.users || [];
        const ids = accounts.map(u=>u.id).filter(id=>UUID.test(id));
        const profiles = ids.length ? await privileged('/rest/v1/student?select='+PROFILE+'&auth_user_id=in.('+ids.join(',')+')') : [];
        const admins = ids.length ? await privileged('/rest/v1/admin_users?select=auth_user_id&auth_user_id=in.('+ids.join(',')+')') : [];
        return reply(200,{page,hasMore:accounts.length === 25,users:accounts.map(u=>({id:u.id,email:u.email || '',created_at:u.created_at,protected:admins.some(a=>a.auth_user_id===u.id),profile:profiles.find(p=>p.auth_user_id===u.id)||null})),majors:await privileged('/rest/v1/major?select=majorid,majorname&order=majorname')});
      }
      if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Problem(415,'Send JSON.');
      // Bound streamed bodies, including requests without Content-Length.
      const reader=request.body?.getReader(); let raw='',size=0;
      if (reader) { const decoder=new TextDecoder(); while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new Problem(413,'Request is too large.');}raw+=decoder.decode(value,{stream:true});} raw+=decoder.decode(); }
      let input;try{input=JSON.parse(raw);}catch{throw new Problem(400,'Invalid JSON.');}
      if (!input || Array.isArray(input) || typeof input!=='object') throw new Problem(400,'Invalid form data.');
      if (method !== 'POST') {
        if (!UUID.test(input.id || '')) throw new Problem(400,'Invalid user ID.');
        const protectedRows = await privileged('/rest/v1/admin_users?select=auth_user_id&auth_user_id=eq.'+input.id);
        if (identity.id === input.id || protectedRows.length) throw new Problem(403,'Admin accounts are protected. Use the normal profile page for your own information.');
        const target = await privileged('/auth/v1/admin/users/'+input.id);
        if (!target?.id && !target?.user?.id) throw new Problem(404,'Account not found.');
      }
      if (method === 'DELETE') {
        // Supabase Auth deletes the login. Migration 02 makes related FK cleanup atomic.
        if (input.confirm !== 'DELETE') throw new Problem(400,'Type DELETE to confirm.');
        await privileged('/auth/v1/admin/users/'+input.id,{method:'DELETE'});
        return reply(200,{message:'Account deleted.'});
      }
      const profile = {};
      for (const field of ['firstname','lastname','nationality']) {
        if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length>120) throw new Problem(400,'Complete the name and nationality fields (maximum 120 characters each).');
        profile[field]=input[field].trim();
      }
      if (!/^\d+$/.test(String(input.majorid || ''))) throw new Problem(400,'Select a major.');
      const majors=await privileged('/rest/v1/major?select=majorid&majorid=eq.'+encodeURIComponent(input.majorid));
      if (!majors.length) throw new Problem(400,'Select a valid major.');
      profile.majorid=String(input.majorid);
      if (!Number.isInteger(input.current_stage) || input.current_stage<0 || input.current_stage>5) throw new Problem(400,'Select a valid journey stage.');
      profile.current_stage=input.current_stage;
      if (method === 'PATCH') {
        // Keep email and NetID stable so existing linked records continue to match.
        const changed=await privileged('/rest/v1/student?auth_user_id=eq.'+input.id+'&select='+PROFILE,{method:'PATCH',body:profile,prefer:'return=representation'});
        if (!changed?.length) throw new Problem(409,'This account has no student profile. Ask the student to sign in once first.');
        return reply(200,{message:'Student profile updated.'});
      }
      if (typeof input.email!=='string' || input.email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new Problem(400,'Enter a valid email.');
      if (typeof input.password!=='string' || input.password.length<12 || input.password.length>128) throw new Problem(400,'Use a temporary password with 12–128 characters.');
      if (!/^[A-Za-z0-9]{4,12}$/.test(input.netid || '')) throw new Problem(400,'NetID must be 4–12 letters or numbers.');
      const duplicates=await privileged('/rest/v1/student?select=studentid&netid=eq.'+encodeURIComponent(input.netid));
      if (duplicates.length) throw new Problem(409,'That NetID is already in use.');
      const created=await privileged('/auth/v1/admin/users',{method:'POST',body:{email:input.email.trim(),password:input.password,email_confirm:true,user_metadata:{firstname:profile.firstname,lastname:profile.lastname,netid:input.netid,nationality:profile.nationality,majorid:profile.majorid}}});
      const id=created?.id || created?.user?.id;
      if (!UUID.test(id || '')) throw new Problem(502,'Account creation returned an unexpected result.');
      try {
        await privileged('/rest/v1/student?on_conflict=auth_user_id',{method:'POST',body:{...profile,netid:input.netid,auth_user_id:id},prefer:'resolution=merge-duplicates,return=minimal'});
      } catch (error) {
        try { await privileged('/auth/v1/admin/users/'+id,{method:'DELETE'}); }
        catch { throw new Problem(502,'The login was created but its profile failed. Check Supabase Authentication before retrying.'); }
        throw error;
      }
      return reply(201,{message:'Student account created.'});
    } catch(error) {
      // Do not log passwords, bearer tokens, keys, or raw upstream responses.
      return reply(error.status || 503,{error:error.status ? error.message : 'The administrator service could not connect. Try again.'});
    }
  };
}
export default {fetch:createHandler()};
