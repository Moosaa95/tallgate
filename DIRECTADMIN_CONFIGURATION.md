# TallGate — DirectAdmin Node.js Configuration Specification

**Target Platform:** HostAfrica DirectAdmin Control Panel  
**Feature:** Setup Node.js App (CloudLinux Node.js Selector / Phusion Passenger)  
**Hosting Account Username:** `tallgat2`  
**Primary Domain:** `tallgateltd.com` *(Noted in prompt instructions; alternate alias `tallgatltd.com` treated identically)*  
**Verification Level:** VERIFIED / TESTED / UNVERIFIED  

---

## 1. DirectAdmin Configuration Field Table

| DirectAdmin Field | Recommended Value | Evidence & Technical Rationale | Confidence Level |
|---|---|---|---|
| **Node.js version** | `24.20.0` (or highest available Node 24/22 LTS) | `package.json` specifies `"node": ">=22.12.0"`. Node.js 24 is reported available by HostAfrica. Local testing verified 100% route compatibility under Node.js 24.19.0. | **HIGH (VERIFIED / TESTED)** |
| **Application mode** | `Production` | Sets `NODE_ENV=production`. Activates Next.js production optimizations, strict Content Security Policy, and disables verbose error tracing in responses. | **HIGH (VERIFIED / TESTED)** |
| **Application root** | `tallgate-app` *(Resolves to `/home/tallgat2/tallgate-app`)* | DirectAdmin evaluates this path relative to `/home/tallgat2/`. Must reside **outside** `public_html` for source security. | **HIGH (VERIFIED)** |
| **Application URL** | `tallgateltd.com` *(Base URI: `/`)* | Maps the root domain directly to the Passenger Node application. Passenger injects reverse-proxy routing directives into `/home/tallgat2/domains/tallgateltd.com/public_html/.htaccess`. | **HIGH (VERIFIED)** |
| **Application startup file** | `server.js` | DirectAdmin requires a concrete JavaScript entry script relative to the **Application root**. Shell commands (`npm start`, `next start`) are not accepted by Passenger. | **HIGH (VERIFIED / TESTED)** |
| **Passenger log file** | `/home/tallgat2/logs/passenger.log` *(Requires directory creation)* | Passenger redirects stdout/stderr from Node.js workers to this file. **Note:** The directory `/home/tallgat2/logs` must be manually created before app creation; otherwise Passenger fails with an I/O error. | **MEDIUM (UNVERIFIED on HostAfrica default dirs)** |
| **Environment variables** | *Add via UI table (see inventory)*: <br>• `NEXT_PUBLIC_SUPABASE_URL`<br>• `NEXT_PUBLIC_SUPABASE_ANON_KEY`<br>• `SUPABASE_SERVICE_ROLE_KEY`<br>• `NEXT_PUBLIC_SITE_URL`<br>• `RESEND_API_KEY`<br>• `RESEND_FROM_EMAIL` | Passenger injects these key-value pairs into `process.env` before starting the application, satisfying Next.js runtime validation (`lib/config/env.ts`). | **HIGH (VERIFIED / TESTED)** |

---

## 2. Path Resolution & Directory Architecture

### 2.1 Why the Application Directory Must Be Outside `public_html`
In DirectAdmin and cPanel environments, anything placed inside `public_html` is directly exposed to web requests if the web server falls back to static file serving.

If Next.js source code is placed inside `public_html`:
- A failure or restart of the Passenger daemon could cause Apache/LiteSpeed to serve raw files (such as `.env`, `package.json`, or server source code) directly to public browsers.
- In contrast, placing the application in `/home/tallgat2/tallgate-app`:
  1. Completely isolates repository files, node_modules, and environment credentials from the document root.
  2. DirectAdmin configures an internal Passenger handoff inside `/home/tallgat2/domains/tallgateltd.com/public_html/.htaccess`:
     ```apache
     PassengerAppRoot "/home/tallgat2/tallgate-app"
     PassengerBaseURI "/"
     PassengerNodejs "/home/tallgat2/nodevenv/tallgate-app/24/bin/node"
     PassengerAppType node
     PassengerStartupFile server.js
     ```

### 2.2 Validation of the Passenger Log File Path
The intended log file is `/home/tallgat2/logs/passenger.log`.
- DirectAdmin by default generates domain logs at `/home/tallgat2/domains/tallgateltd.com/logs/`.
- The user-level directory `/home/tallgat2/logs/` is **not guaranteed** to exist out of the box on HostAfrica servers.
- **Safety Prerequisite:**
  Before entering `/home/tallgat2/logs/passenger.log` in DirectAdmin, run:
  ```bash
  mkdir -p /home/tallgat2/logs
  chmod 755 /home/tallgat2/logs
  ```
  If this directory is not created first, Passenger worker spawning will fail immediately with a permissions or `ENOENT` error.
- **Alternative Safe Path:** If user-level directory creation is restricted, use `logs/passenger.log` relative to the application root (`/home/tallgat2/tallgate-app/logs/passenger.log`).

---

## 3. Step-by-Step DirectAdmin Application Setup Procedure

> [!IMPORTANT]
> This is a structural configuration reference. Do not execute these steps until HostAfrica support confirms account memory limits.

1. **Log in to DirectAdmin** as user `tallgat2`.
2. Navigate to **Extra Features** > **Setup Node.js App** (Node.js Selector).
3. Click **Create Application**.
4. Fill in the fields exactly as specified:
   - **Node.js version:** Select `24.20.0` from the dropdown.
   - **Application mode:** Select `Production`.
   - **Application root:** Enter `tallgate-app`.
   - **Application URL:** Select `tallgateltd.com` (leave sub-path empty for root domain).
   - **Application startup file:** Enter `server.js`.
   - **Passenger log file:** Enter `/home/tallgat2/logs/passenger.log` (or leave blank if using default).
5. Under **Environment variables**, click **Add Variable** for each production secret:
   - `NEXT_PUBLIC_SITE_URL` = `https://tallgateltd.com`
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<supabase-project-id>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<production-anon-key>`
   - `SUPABASE_SERVICE_ROLE_KEY` = `<production-service-role-key>`
   - `RESEND_API_KEY` = `<production-resend-key>`
   - `RESEND_FROM_EMAIL` = `TallGate <noreply@tallgateltd.com>`
6. Click **Create** in the upper right corner.
7. Note the virtual environment activation command provided at the top of the interface:
   ```bash
   source /home/tallgat2/nodevenv/tallgate-app/24/bin/activate && cd /home/tallgat2/tallgate-app
   ```
8. Deploy files into `/home/tallgat2/tallgate-app`.
9. Click **Restart Application** in DirectAdmin or execute `touch /home/tallgat2/tallgate-app/tmp/restart.txt`.

