# BYU Navigator

## App Summary

BYU Navigator helps international students find BYU resources and organize their next steps, from applying through graduation. Students sign in with email, save their current journey stage, track personal tasks, and generate three AI-powered next-step suggestions. They can also simulate course registration, view registered credits, and organize academic plans and advising notes. The website supports multiple languages and links to official BYU offices.

## Live Website

[Open BYU Navigator](https://byu-navigator.vercel.app/)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | HTML, CSS, JavaScript |
| Authentication and database | Supabase Auth and PostgreSQL |
| Hosting and AI backend | Vercel and Vercel Functions |
| AI service | Google Gemini API |
| Local server | Node.js 22 or later |

## How to Run Locally

1. Install Node.js 22 or later and Git, then clone the repository:

   ```bash
   git clone https://github.com/msaku3/byu-navigator.git
   cd byu-navigator/byu-navigator
   ```

   This application folder contains `package.json`, `server.js`, and `public/`.

2. Create a `.env` file beside `server.js`:

   ```dotenv
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_publishable_or_anon_key
   ```

   **Ask a team member for the configuration values.** The team's shared Supabase project already contains the database tables and sample data. Make sure the Supabase configuration in `public/index.html` points to the same project. Keep `.env` and secret keys out of Git.

3. Start the server:

   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000). Create an account, confirm your email if prompted, and sign in. Stop the server with **Control+C**.

**AI testing:** The local server does not handle `/api/journey-plan`. Use the live website or a Vercel Preview to test AI generation. Vercel uses the `byu-navigator` Root Directory and these environment variables: `SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`, and `GEMINI_MODEL`. Configure them for Preview and Production, then deploy. Keep `GEMINI_API_KEY` secret and only on the backend.

## AI Workflow

When a student clicks **Generate my next steps**, a Vercel function verifies their identity through Supabase Auth and retrieves their saved journey stage. It sends the stage and curated guidance to Gemini, which generates three suggested actions. The frontend displays those actions alongside official resource links. Student names, emails, passwords, and personal notes are not sent to Gemini.

## Prototype Notes

- Course registration is a Demo Term simulation. Use MyMap for official BYU registration.
- Profiles, current journey stages, and demo enrollments save in Supabase. Checklists, custom stages, academic plans, milestones, and advising notes save only in the browser for that account.
- The AI planner uses the saved standard journey stage, not custom stages or checklist edits. Confirm important requirements with the relevant BYU office.
- Appointment requests open an email draft; they do not confirm an appointment booking.

## Diagrams

### Entity Relationship Diagram

![ERD](Module%205%20ERD.png)

### Level 1 — Student Profile and AI Journey Workflow

This diagram covers the profile and AI journey workflow.

![Level 1 student profile and AI journey workflow](images/journey-workflow-level1.png)
