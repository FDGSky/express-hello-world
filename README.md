# Mini Office AI — Pixel-Art Multi-Agent HQ

A live, interactive **Pixel-Art Multi-AI Customer Service Office** inspired by *The Office*, built with **Express 5 + TypeScript + React + Tailwind + HTML5 Canvas + Neon PostgreSQL**.

Designed for **2 isolated US businesses** (English, USD `$`, EST `UTC-5`, `MM/DD/YYYY`):
- **BrightNest Pro Cleaning** *(Residential & Commercial Cleaning)*
- **Keystone Crest Realty** *(Residential & Investment Real Estate)*

---

## Live 4-Stage Pipeline

1. **Security Guard (Entrance Desk):** Scans every incoming SMS, link, image, and document using:
   - **Magic-Byte & Extension Inspector** (blocks executables, scripts, and spoofed `.exe`-as-`.png` files)
   - **EICAR Antivirus Signature & XSS Shield**
   - **Heuristic URL Analyzer** (blocks raw IPs, SSRF, punycode/homograph spoofing, shorteners, phishing patterns)
   - **URLhaus (abuse.ch)** free real-time malware feed
   - **VirusTotal API v3** (`VIRUSTOTAL_API_KEY`) hash & URL lookup
2. **Reception Support Agent:** Reads sanitized text, images, and attachments alongside the active business's isolated catalog and EST calendar slots, then drafts a concise SMS reply.
3. **4-AI Jury (Conference Room):** Calls **Claude, Gemini, GPT, and DeepSeek** in parallel via **OpenRouter** (`OPENROUTER_API_KEY`) to score **Brand Coherence (0–100)** and **Message Context (0–100)** and check for cross-business leakage or policy violations.
4. **Boss Corner Office (Human-in-the-Loop — PC & iPhone PWA):**
   - **BAA (Boss Approves All):** Every outgoing SMS waits for 1-tap **Approve / Edit & Send / Rewrite / Reject**.
   - **Auto-Pilot:** Sends automatically when Security = Safe, Jury Consensus ≥ threshold, and no sensitive keywords trigger; escalates edge cases to the Boss.

---

## Free Cloud Deployment (No Credit Card Required)

### 1. Database — Neon PostgreSQL (Free)
1. Create a free account at [neon.tech](https://neon.tech) (no credit card required).
2. Create a new project and copy your **Connection String** (`DATABASE_URL`).
3. On first boot, the server automatically runs `src/server/db/schema.sql` and seeds both demo businesses.

### 2. Hosting — Render (Free Web Service)
1. Push this repo to GitHub.
2. On [render.com](https://render.com), click **New + → Web Service** and connect this repository (or use `render.yaml`).
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. Add Environment Variables in Render:
   - `DATABASE_URL` → your Neon connection string
   - `OPENROUTER_API_KEY` → single key from [openrouter.ai](https://openrouter.ai) (supports debit cards for Claude, Gemini, GPT, DeepSeek; leave blank to run in **Smart Simulation Mode**)
   - `VIRUSTOTAL_API_KEY` → free API key from [virustotal.com](https://www.virustotal.com)
   - `DEMO_ACCESS_CODE` → optional PIN/passcode to protect your public demo URL

### 3. iPhone Boss Approval (PWA)
Open your Render URL in **iPhone Safari** → tap **Share** → **Add to Home Screen**. The app opens full-screen with a dedicated **Boss** approval tab.

### 4. Real US SMS (Twilio Webhook Ready)
When ready to connect live SMS, point your Twilio phone number Messaging webhook to:
```
POST https://<your-render-url>/api/webhooks/twilio/sms
```
and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_CLEANING`, and `TWILIO_PHONE_REALESTATE`.

---

## Local Development

```bash
cp .env.example .env
npm install
npm run build
npm start
# Open http://localhost:3001
```
