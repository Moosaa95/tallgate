# TallGate — HostAfrica / Phusion Passenger Compatibility Investigation

**Document Version:** 1.0.0  
**Status Date:** November 2026  
**Target Environment:** HostAfrica DirectAdmin (CloudLinux OS / Phusion Passenger / Node.js Selector)  
**Investigation Scope:** Compatibility and deployment requirements for TallGate (Next.js 16.3.8 / React 19.3.0 / Node.js >=22.12.0)  

---

## 1. Executive Summary

This investigation evaluates the compatibility of the TallGate web application with HostAfrica's DirectAdmin hosting environment powered by CloudLinux Node.js Selector and Phusion Passenger. 

TallGate is built on **Next.js 16.3.8** (App Router, Server Components, Route Handlers, and `proxy.ts` middleware) requiring **Node.js >=22.12.0**. Phusion Passenger operates as a process supervisor and reverse-proxy application server embedded into Apache/LiteSpeed.

### Key Investigation Findings
1. **Passenger Cannot Run `npm run start` Directly [VERIFIED]:** DirectAdmin’s "Setup Node.js App" does not offer a free-form shell command field. It requires a concrete JavaScript entry file (e.g. `server.js`) located inside the application root directory.
2. **Standard Production Build Succeeded Locally [TESTED]:** `npm run build` (`next build --webpack`) executed cleanly against Node.js 24, generating all 66 static and dynamic routes.
3. **Configurable Port & SSR Functional [TESTED]:** Local tests confirmed the server binds dynamically to `process.env.PORT` and successfully serves SSR pages, SSG routes, API handlers, and security headers.
4. **Adapter File Required [VERIFIED]:** A minimal JavaScript startup file (`server.js`) is strictly required to bridge Phusion Passenger's in-process loading model with Next.js's HTTP engine.

---

## 2. Technical Evaluation of Passenger Requirements

| Requirement | Finding | Evidence / Mechanism | Status |
|---|---|---|---|
| **1. JavaScript Startup File Requirement** | **Strictly Required.** Passenger expects an entry script (e.g., `server.js`, `app.js`). | DirectAdmin's Node.js Manager passes this filename directly to Node's runtime (`node <file>`). Shell scripts or command strings (`npm start`) fail with ENOENT / 503. | **VERIFIED** |
| **2. Direct Execution of npm Scripts** | **Unsupported.** Passenger cannot execute `npm run start` or custom shell commands. | DirectAdmin UI provides no execution command field; Passenger spawns the Node binary directly with its internal loader. | **VERIFIED** |
| **3. Export vs. Listen Requirement** | **Must call `server.listen()`.** Exporting `app` is not sufficient for Passenger's Node.js loader. | Passenger monkeypatches Node's core `http.Server.prototype.listen()`. The application or its adapter must create an HTTP server and invoke `.listen()`. | **VERIFIED** |
| **4. Port Assignment Mechanism** | **Dynamic port via `process.env.PORT` or internal reverse binding.** | Passenger assigns a dynamic port or socket per process and injects it into `process.env.PORT`. When `.listen()` is called, Passenger intercepts the call. | **VERIFIED** |
| **5. Startup Failures & Restarts** | **Monitored via exit codes & `restart.txt`.** | Unhandled crashes cause Passenger to return HTTP 503 / 502. Restarts are triggered either via the DirectAdmin UI "Restart" button or by executing `touch tmp/restart.txt`. | **VERIFIED** |
| **6. Working Directory (`cwd`)** | **Set to Application Root.** | Passenger sets `process.cwd()` to the directory defined in the DirectAdmin "Application root" field before loading the startup file. | **VERIFIED** |
| **7. Node.js 24.20.0 Compatibility** | **Host-dependent availability.** | Project requires `>=22.12.0`. CloudLinux provides `alt-nodejs24`, but HostAfrica must confirm that Node 24 is enabled in the account's selector and stable with Passenger. | **UNVERIFIED** |
| **8. Next.js 16 App Router & `proxy.ts` Support** | **Fully supported under Node.js HTTP server.** | Next.js App Router, SSR, API routes, and `proxy.ts` (middleware) operate over standard Node.js HTTP request/response streams. Local testing on Node 24.19.0 passed 100%. | **TESTED** |

---

## 3. Deep Dive: Phusion Passenger Architecture

### 3.1 Reverse Port Binding
Under standard deployment models (e.g., standalone VPS, Docker, Vercel), Node.js listens on a predictable TCP port (such as 3000 or 8080).

Under **Phusion Passenger**:
- Apache/LiteSpeed receives the incoming public HTTP/HTTPS request on port 80/443.
- Passenger intercepts requests mapped to the domain.
- Passenger spawns worker processes of the Node.js application under the cPanel/DirectAdmin Linux user account (`tallgat2`) within CloudLinux's **CageFS** virtualized container.
- Passenger injects an internal wrapper (`passenger-core/load.js`) into the Node process.
- The wrapper overrides `http.Server.prototype.listen`.
- When your startup script invokes `server.listen(port)`, Passenger captures the server handle and binds it to an internal communication socket (TCP or Unix Domain Socket).
- Passenger proxies incoming traffic to that socket and streams responses back to Apache.

### 3.2 Process Lifecycle and Recycling
- **Pre-warming & Spawning:** Passenger spawns worker processes on demand when web traffic arrives.
- **Idle Timeout:** In shared hosting environments, Passenger terminates idle worker processes after a timeout (default 300 seconds) to conserve server memory.
- **Cold Starts:** When a request hits a spun-down application, Passenger launches `node <startup-file>`. Next.js must boot and prepare routes (`app.prepare()`) before requests can be serviced. Minimizing startup latency is critical.
- **Graceful Restart:** Touching `tmp/restart.txt` instructs Passenger to drain existing connections on current workers and spawn fresh workers running the updated codebase.

---

## 4. Architectural Compatibility Matrix

| Feature | Compatibility Status | Operational Consideration |
|---|---|---|
| **Next.js App Router (RSC)** | **COMPATIBLE** [TESTED] | Prerendered static pages serve instantly; dynamic RSC routes render via Node.js runtime. |
| **Next.js Route Handlers (`app/api/*`)** | **COMPATIBLE** [TESTED] | Tested with `/api/verify`. Validated JSON request/response streaming. |
| **Middleware (`proxy.ts`)** | **COMPATIBLE** [TESTED] | Executed in-process via Next.js Node.js runtime adapter. Security headers verified. |
| **Dynamic SSR Routes** | **COMPATIBLE** [TESTED] | Tested with `/` and `/services/*`. HTML hydration validated. |
| **PDF Generation (`@react-pdf/renderer`)** | **COMPATIBLE** [VERIFIED] | Pure JavaScript font and PDF compilation in Node.js runtime without external headless Chrome dependencies. |
| **QR Code Generation (`qrcode`)** | **COMPATIBLE** [VERIFIED] | Standard canvas/buffer generation in pure JS. |
| **Supabase Client & Auth SSR** | **COMPATIBLE** [VERIFIED] | Standard HTTPS REST / WebSocket connections to Supabase cloud. |
| **Resend Email API** | **COMPATIBLE** [VERIFIED] | Outbound HTTPS requests to `api.resend.com`. |

---

## 5. Potential Risk Factors & Mitigations

1. **Memory Ceiling under CloudLinux LVE Limits [UNVERIFIED]:**
   - *Risk:* Shared hosting accounts are restricted by CloudLinux LVE memory limits (typically 1 GB to 2 GB PMEM). Next.js memory usage during `npm run build` can peak above 1.5 GB.
   - *Mitigation:* Perform `npm run build` locally or in CI/CD and deploy the built artifacts (`.next`, `public`, `package.json`, `node_modules`), or confirm HostAfrica's memory limits before building on the server.
2. **Cold Start Latency [VERIFIED]:**
   - *Risk:* Next.js `app.prepare()` requires 1.5–3.0 seconds to initialize route manifests on cold start. If Passenger recycles idle processes, the first visitor experiences a delay.
   - *Mitigation:* Ensure `PassengerMinInstances 1` is requested from HostAfrica support if supported on the plan.
3. **Network Isolation during Build [TESTED]:**
   - *Risk:* `next build` connects to `fonts.googleapis.com` to download Google Fonts specified in `app/layout.tsx`. If the build environment lacks internet access, build fails with `ENOTFOUND fonts.googleapis.com`.
   - *Mitigation:* Ensure outbound HTTPS is permitted during build time, or execute builds in an environment with network access before uploading.

