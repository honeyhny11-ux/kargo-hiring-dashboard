# Kargo Hiring Dashboard

A ranked PM and SPM shortlist for Arjun, scored against a rubric built from Kargo's best past hires. For each
candidate it shows the rubric scores (on both rubrics), a 3-sentence interview brief, and a draft invite or rejection
email that only sends after Arjun clicks **Confirm & send**.

> The system recommends. Arjun decides.

Stack: Next.js (App Router) · Supabase · Gemini (billed API) · Resend · Vercel.

## How it works

1. **Rubric page: past hires → rubric.** Enter the 8 hire profiles (Exceeds: Rohan, Sunita, Aditya, Meghna, Lavanya;
   Meets: Vikram, Rahul; Below: Preetham). Gemini compares the Exceeds hires with the weaker ones and drafts 4–6
   criteria per role. Each criterion lists the Exceeds hires it traces back to and how the weaker hires differ. Arjun
   edits the draft. It can't be approved until it has 4–6 criteria, the weights add up to 100%, and every criterion
   traces to at least one Exceeds hire. Hire names are swapped for labels (H1, H2…) before they reach Gemini.
2. **Upload CVs.** Each file is read (DOCX, PDF or TXT) and split straight away: name, email and phone go to the
   `candidates` table, and the CV content (with contact lines and personal-detail lines removed) goes to
   `candidate_content`. Only that content is ever sent to Gemini.
3. **Score.** On the shortlist, click **Score now**. Each CV is scored against **both** rubrics in one Gemini call that
   returns JSON: a 1–5 score, confidence, evidence quote and reason per criterion, plus a 3-sentence brief, strengths
   and top concern. The app then:
   - works out the weighted total itself (score ÷ 5 × weight), so it's the same arithmetic for everyone;
   - checks every evidence quote against the CV text, drops unverifiable ones to LOW confidence and flags them;
   - flags candidates who score at least 10 points higher on the other level's rubric.

   Years of PM experience are shown as information only and are never scored.
4. **Decide.** On a candidate's page Arjun clicks **Invite** or **Reject**. Gemini drafts the email with
   `{{first_name}}` as a placeholder, which the app fills in, so the name never goes to the model. Arjun edits the
   draft, ticks the confirmation box and clicks **Confirm & send**. Resend sends it. This is the only code path that
   sends an email.
5. **Activity** keeps the written record of every upload, score, decision and email.

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. Open **SQL Editor → New query**, paste `supabase/schema.sql` and click **Run**.
3. From **Project Settings → API**, copy the Project URL and the `service_role` key.

Row Level Security is on with no policies, so the tables can only be reached with the service-role key, which is used
on the server only.

### 2. Gemini (billed)
Create an API key in Google AI Studio **in a project with billing enabled**. The free tier may use your inputs to train
Google's models; the billed API doesn't. Calls also set `store: false`, so interactions aren't kept on Google's side.

### 3. Resend
Create an API key at resend.com. Without a verified domain, the free tier only sends to your own account email, so set
`RESEND_TEST_TO` to that address. Every email then goes to your test inbox, with the real recipient shown in the
subject line.

### 4. Environment variables
Copy `.env.example` to `.env.local` and fill it in. `.env*` is in `.gitignore`, and only `.env.example` is committed.

```bash
cp .env.example .env.local
```

### 5. Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000. There is no login.

### 6. Deploy to Vercel
1. Push the project to GitHub and import it in Vercel.
2. Add every variable from `.env.example` under **Settings → Environment Variables**.
   ⚠️ The app has no login. Before sharing the URL, turn on **Settings → Deployment Protection → Vercel Authentication** (Standard Protection), so only people signed in to your Vercel team can open it. Otherwise anyone with the link can see candidate names, emails and phone numbers.
3. **Redeploy**, so the new variables take effect.

## Tests
```bash
npm test
```
Covers the weighted total, the confidence rule, priority labels, quote checking, rubric validation (4–6 criteria,
100%, traced to Exceeds hires), and the PII split.

## Files
| Path | What it does |
|---|---|
| `src/lib/pii.ts` | Separates name, email and phone from CV content; swaps hire names for labels |
| `src/lib/scoring.ts` | Weighted totals, confidence, quote checks, rubric validation (no AI) |
| `src/lib/prompts.ts`, `schemas.ts` | Gemini prompts and JSON schemas |
| `src/lib/pipeline.ts` | Rubric generation, scoring, email drafting |
| `src/app/actions.ts` | Server actions: upload, rubric, decide, Confirm & send |
| `supabase/schema.sql` | Tables: candidates, candidate_content, hires, rubric, scores, emails, audit |
