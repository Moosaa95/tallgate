# TallGate — Startup Implementation Evaluation & Recommendation

**Investigation Goal:** Determine the technically optimal startup strategy for deploying TallGate on HostAfrica DirectAdmin under Phusion Passenger.  
**Deliverable Status:** INVESTIGATION & PROPOSAL ONLY (No files modified in repository).  

---

## 1. Evaluation of Candidate Startup Approaches

### Option A — Existing Next.js Production Server (`next start` / `npm run start`)

- **Mechanism:** Direct execution of Next.js’s CLI binary (`next start`) through the standard Node process.
- **DirectAdmin / Passenger Compatibility:** **INCOMPATIBLE [VERIFIED]**. Passenger’s DirectAdmin interface requires an *Application startup file* (a `.js` file). Entering `next start` or `npm run start` causes Passenger to look for a file by that literal string name, resulting in a fatal `ENOENT` / HTTP 503 error.
- **Verdict:** Unviable for DirectAdmin Phusion Passenger without a startup file.

---

### Option B — Minimal Internal Launcher Adapter (`server.js` invoking `startServer`)

- **Mechanism:** A minimal script that directly requires Next.js's internal server engine:

  ```javascript
  const { startServer } = require('next/dist/server/lib/start-server');
  startServer({ dir: __dirname, isDev: false, hostname: '0.0.0.0', port: parseInt(process.env.PORT || '3000', 10) });
  ```

- **Tradeoffs:**
  - *Pros:* Uses Next.js’s native internal HTTP server identically to `next start`.
  - *Cons:* Relies on private internal paths (`next/dist/server/lib/start-server`) that are not guaranteed to remain stable across Next.js patch/minor releases.
- **Verdict:** Operates well in testing, but introduces unnecessary coupling to unexported framework internals.

---

### Option C — Programmatic Next.js HTTP Adapter (Public API `next()` + `http.createServer`)

- **Mechanism:** Standard, officially documented Next.js programmatic integration:

  ```javascript
  const http = require('http');
  const next = require('next');
  const app = next({ dev: false, dir: __dirname });
  const handle = app.getRequestHandler();
  const port = process.env.PORT || 3000;

  app.prepare().then(() => {
    http.createServer((req, res) => handle(req, res)).listen(port);
  });
  ```

- **DirectAdmin / Passenger Compatibility:** **OPTIMAL [TESTED]**.
  - Passenger intercepts `http.Server.prototype.listen()`, seamlessly routing web traffic to the application instance.
  - Relies solely on public, stable Next.js APIs (`next()`, `app.getRequestHandler()`, `app.prepare()`).
  - Completely preserves App Router, Server Components, SSR, API routes, and `proxy.ts` middleware.
  - Requires **zero** changes to `package.json`, `next.config.mjs`, or build pipelines.
- **Verdict:** Recommended approach.

---

### Option D — Next.js Standalone Deployment (`output: 'standalone'`)

- **Mechanism:** Setting `output: 'standalone'` in `next.config.mjs`. Next.js uses file tracing to compile a stripped-down `node_modules` and generates `.next/standalone/server.js`.
- **Tradeoffs:**
  - *Pros:* Smaller deployed artifact size; pre-generates a `server.js`.
  - *Cons:*
    1. Static files (`public/` and `.next/static/`) are **not** bundled into `.next/standalone` by default; deployment scripts must manually copy them via bash (`cp -r public ... && cp -r .next/static ...`).
    2. Modifies `next.config.mjs` (disallowed under current constraints).
    3. May miss dynamic asset tracing for binary dependencies (such as `@react-pdf/renderer` font assets) unless explicitly configured.
    4. Complicates DirectAdmin's Application root path mapping.
- **Verdict:** High operational complexity with no significant benefit over Option C on this hosting setup.

---

## 2. Comparative Evaluation Matrix

| Evaluation Criteria | Option A (`next start`) | Option B (Internal `startServer`) | Option C (Public HTTP Adapter) | Option D (Standalone Output) |
| --- | --- | --- | --- | --- |
| **Passenger Compatibility** | ❌ Fails (No CLI hook) | ✅ Compatible | ✅ **Fully Compatible** | ⚠️ Partial (Asset copy required) |
| **Public API Stability** | N/A | ❌ Low (Private internals) | ✅ **High (Official Next.js API)** | ✅ High |
| **Next.js Feature Preservation** | N/A | ✅ 100% | ✅ **100% (App Router, SSR, Middleware)** | ⚠️ Requires manual static copying |
| **Deployment Complexity** | None | Low (1 root file) | ✅ **Lowest (1 root file, standard build)** | High (Multi-step folder copy) |
| **Config File Modifications** | None | None | ✅ **None (`next.config.mjs` unchanged)** | Requires `output: 'standalone'` |
| **Performance & Latency** | Baseline | Identical to baseline | ✅ **Identical to baseline** | Marginally smaller memory footprint |
| **Process Control / Shutdown** | Handled by CLI | Handled by Next | ✅ **Clean Passenger intercept & SIGTERM** | Handled by standalone script |

---

## 3. Recommended Approach & Justification

### Recommendation: **Option C — Programmatic Next.js HTTP Adapter**

**Justification:**

1. **Full Compliance with DirectAdmin:** Provides an exact, single-file entry script (`server.js`) located in the root of the application directory.
2. **Clean Passenger Interception:** Phusion Passenger relies on intercepting Node’s core `http.Server.prototype.listen()`. Option C instantiates an explicit `http.Server`, allowing Passenger's C++ hooks to bind internal sockets seamlessly.
3. **Architectural Safety:** Unlike Option B, Option C does not invoke private `next/dist/server/...` functions. Unlike Option D, it does not require fragile post-build folder copying or `next.config.mjs` alterations.
4. **Zero Script Disruption:** Development and local workflows (`npm run dev`, `npm run build`, `npm run start`) remain 100% untouched.

---

## 4. Proposed Startup File Specification

### 4.1 Filename and Exact Relative Path

- **Filename:** `server.js`
- **Relative Path:** `./server.js` (placed directly in the application root, parallel to `package.json`).
- **DirectAdmin Field Value:** `server.js`

### 4.2 Proposed File Contents (`server.js`)

```javascript
/**
 * TallGate — Production Startup Adapter for Phusion Passenger
 * 
 * Provides an explicit http.Server entry point for DirectAdmin / CloudLinux
 * Node.js Selector while delegating all routing, rendering, and middleware
 * to the compiled Next.js production engine.
 */

const http = require('http');
const next = require('next');

// DirectAdmin / Passenger runs with NODE_ENV=production
const isDev = process.env.NODE_ENV !== 'production';

// Initialize Next.js in production mode pointing to the current directory
const app = next({
  dev: isDev,
  dir: __dirname,
  quiet: false
});

const handle = app.getRequestHandler();

// Passenger injects the assigned socket/port into process.env.PORT
const port = parseInt(process.env.PORT || '3000', 10);
const hostname = process.env.HOSTNAME || '127.0.0.1';

app.prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      // Delegate 100% of HTTP traffic to Next.js (App Router, SSR, API, proxy)
      handle(req, res);
    });

    // Listen on Passenger's designated port/socket
    server.listen(port, hostname, (err) => {
      if (err) {
        console.error('Fatal error binding server listener:', err);
        process.exit(1);
      }
      console.log(`> TallGate production server active on ${hostname}:${port} (PID: ${process.pid})`);
    });

    // Clean process termination on Passenger worker recycling
    const gracefulShutdown = (signal) => {
      console.log(`Received ${signal}. Draining connections...`);
      server.close(() => {
        console.log('HTTP server closed cleanly. Exiting.');
        process.exit(0);
      });
      // Force exit if connections do not drain within 10 seconds
      setTimeout(() => {
        console.error('Forced exit timeout exceeded.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('Failed to prepare Next.js application:', err);
    process.exit(1);
  });
```

### 4.3 Why This Implementation is Compatible with Passenger

1. **Dynamic Port Binding:** Reads `process.env.PORT || 3000`. If Passenger supplies a dynamic TCP port or numeric socket descriptor, the server binds cleanly.
2. **Reverse Port Interception:** Passenger’s C++ agent hooks `http.Server.prototype.listen()`. When `server.listen()` is called inside `app.prepare().then()`, Passenger detects application readiness and opens the proxy pipe.
3. **Graceful Worker Shutdown:** CloudLinux Passenger recycles worker processes during low traffic periods or after configuration updates (`touch tmp/restart.txt`). Listening for `SIGTERM` ensures existing transactions (such as PDF generation or Stripe callbacks) drain cleanly before the process exits.
4. **No Package Script Changes:** `package.json` scripts (`"build": "next build --webpack"`, `"start": "next start"`) do not require alteration.
