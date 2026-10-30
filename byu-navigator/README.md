# BYU Navigator: Node prototype

This package moves database calls from HTML into server.js. The browser calls two specific routes: GET /api/majors and POST /api/students. The server reads the Supabase URL and key from .env, which is never served to the browser. The original layout is preserved.

## Start on your Mac

1. Extract this ZIP and open the byu-navigator folder in VS Code.
2. Open Terminal > New Terminal. Confirm the folder contains package.json and server.js by running `ls`.
3. Run `node --version`. Use Node 22 or newer.
4. Copy the example settings: `cp .env.example .env`.
5. Open .env in VS Code. Replace the URL and key placeholders with your Supabase project URL and **publishable key** (or legacy anon key). Do not use a secret/service_role key. Keep this file out of GitHub; .gitignore excludes it.
6. Check your **major** table's primary-key column in Supabase. If it is `id`, set `MAJOR_ID_COLUMN=id`. If it is `majorid`, leave the default. The student's foreign key is still `majorid`.
7. Run `npm start`.
8. Open http://localhost:3000 in your browser. Do not open the HTML directly or start Live Server for this version.

No npm install is needed: this server uses Node's built-in modules. Leave Terminal running. Control+C stops the server. Restart it after editing .env or server.js.

Expected folder:

- public/index.html — your page
- server.js — web server and database calls
- package.json — start command
- .env.example — settings template
- .env — your local settings, created in step 4
- .gitignore — excludes your local settings

## Verify the database connection

Open Create account. The connection status should say Connected. Submit a test student with a unique NetID and verify the row in Supabase's student table. The server also creates a major if the typed major is missing. A new major can remain if saving the student fails; these are separate requests.

The expected student columns are studentid (generated automatically), netid, firstname, lastname, nationality, majorid. The expected major columns are id OR majorid (generated automatically), majorname, department.

If you see a permissions error, check table grants and RLS policies in Supabase. Moving the key to Node does not fix overly broad database permissions. Use fake student details for this prototype. Do not disable RLS as a troubleshooting shortcut. A publishable/anon key still obeys RLS when used by this server; authenticated-only policies need actual authentication, which this prototype does not implement.

## Sign-in limitation

Create account saves student details only. Its password field is checked for length but is neither transmitted nor saved. Sign-in still opens a sample profile; it does not authenticate a user or retrieve the saved student. A real account system requires a separate Supabase Auth implementation. Refreshing clears the in-memory profile.

## Test on iPhone

Keep your Mac and iPhone on the same trusted Wi-Fi. Find the Mac IP under System Settings > Wi-Fi > Details > TCP/IP. Open http://YOUR_MAC_IP:3000 in iPhone Safari. Allow Node through the Mac firewall if prompted. Guest or campus Wi-Fi may block connections between devices.

## Scope and security

This is a local classroom prototype. The server exposes a public profile-submission route and major-list route; it does not provide authenticated user access or abuse protection. .env is a configuration boundary, not a replacement for authorization and RLS. Only the HTML is served as a file; .env and server.js return 404. Do not put real student records into a database whose access policies have not been reviewed.

## Verification performed for this package

JavaScript syntax checked. Local server checked against a simulated Supabase REST API for major loading, existing/new-major student saves, invalid inputs, and private-file blocking. No live database credentials were provided, so your actual Supabase connection still needs the steps above.
