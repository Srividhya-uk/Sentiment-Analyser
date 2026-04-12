# Grayling AI Sentiment Analyser

Real-time public sentiment intelligence powered by NVIDIA Nemotron 4 340B.

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/grayling-sentiment.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your repo and click Deploy

### 3. Add Environment Variables in Vercel

Go to: Project > Settings > Environment Variables

Add these two:

| Name | Value |
|------|-------|
| `NVIDIA_API_KEY` | `nvapi-your-key-here` |
| `RESEND_API_KEY` | `re_your-resend-key-here` |

Tick all three environments (Production, Preview, Development) then Save.

### 4. Get your Resend API key

1. Sign up free at https://resend.com
2. Go to API Keys and create a new key
3. Paste it as RESEND_API_KEY in Vercel

### 5. Redeploy

Go to Deployments and click Redeploy on the latest deployment.

---

## How It Works

- **Public view:** Shows positive signals only. Negative score is locked behind a "Full Report" gate.
- **Grayling search:** Always returns 89% positive, fully curated result.
- **Full Report CTA:** Visitor fills in Name, Company, Job Title, Work Email.
- **Email:** Grayling receives the lead details + a full PDF report (including negatives) at srividhyanatarajan11@gmail.com.

---

## Local Development

```bash
npm install
npx vercel dev
```

Create `.env.local` (never commit this):
```
NVIDIA_API_KEY=nvapi-your-key-here
RESEND_API_KEY=re_your-resend-key-here
```

---

## Project Structure

```
grayling-sentiment/
  api/
    analyse.js    -- NVIDIA Nemotron proxy (holds API key)
    contact.js    -- PDF generator + Resend email handler
  public/
    index.html    -- Frontend (no keys, safe for GitHub)
  package.json
  vercel.json
  .gitignore
  README.md
```
