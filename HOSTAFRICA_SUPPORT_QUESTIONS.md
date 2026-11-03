# HostAfrica Technical Support Questionnaire

**Target Recipient:** HostAfrica Tier-2 / Tier-3 Hosting Infrastructure Support  
**Account Username:** `tallgat2`  
**Primary Domain:** `tallgateltd.com`  
**Application Tech Stack:** Next.js 16.3.8 / React 19.3.0 / Node.js 24.x  

---

## Technical Inquiries for HostAfrica Support

Please submit the following specific questions to HostAfrica technical support before finalizing the production deployment.

### 1. Node.js 24 Availability and Passenger Stability [UNVERIFIED]
> **Question:**  
> "Our application requires Node.js `>=22.12.0` (targetting `Node.js 24.20.0`). Is `alt-nodejs24` fully enabled and supported under the CloudLinux Node.js Selector on the server hosting `tallgat2`, and is the installed Phusion Passenger module verified to spawn Node.js 24 worker processes without ABI or glibc compatibility issues?"

---

### 2. CloudLinux LVE Resource Limits (Memory & CPU) [UNVERIFIED]
> **Question:**  
> "Next.js 16 compilation (`npm run build`) and server-side rendering peak at approximately 1.2 GB – 1.8 GB of physical memory (PMEM). What are the exact CloudLinux LVE memory limits (PMEM and VMEM), process limits (NPROC), and CPU allocations assigned to user `tallgat2`? Will a Next.js production build exceed the account's memory ceiling and be killed by the Linux OOM killer?"

---

### 3. SSH / Jailed Shell Access for Build & Dependency Installation [UNVERIFIED]
> **Question:**  
> "Is SSH / Jailed Shell access enabled for user `tallgat2`? If so, does the jailed environment allow outbound HTTPS connections to `npmjs.org` and `fonts.googleapis.com` (required by Next.js font optimization during `next build`), or are outbound network connections restricted?"

---

### 4. Application Directory Outside `public_html` [UNVERIFIED]
> **Question:**  
> "We plan to place the application root in `/home/tallgat2/tallgate-app` (strictly outside `public_html` for credential protection). Does DirectAdmin's Node.js App manager correctly write the required Passenger `.htaccess` reverse-proxy directives to `/home/tallgat2/domains/tallgateltd.com/public_html/.htaccess` when mapping the primary domain to a directory outside `public_html`?"

---

### 5. Passenger Custom Log File Path [UNVERIFIED]
> **Question:**  
> "We intend to set the Passenger log file to `/home/tallgat2/logs/passenger.log`. Does the `/home/tallgat2/logs` directory exist with user-write permissions by default, or must we create it manually? If custom user log paths are not supported by the Passenger Apache module, what is the default error log location for Node.js worker crashes?"

---

### 6. Process Recycling and Idle Timeout [UNVERIFIED]
> **Question:**  
> "What is the configured `PassengerPoolIdleTime` on the server? Does HostAfrica allow setting `PassengerMinInstances 1` or `PassengerPreStart` to prevent cold-start delays when idle workers are spun down?"

