# BYU Navigator

[Open BYU Navigator](https://byu-navigator.vercel.app/)

## App Summary

BYU Navigator helps international students find resources and organize their next steps, from applying to BYU through graduation. It brings journey guidance, academic planning tools, and links to official BYU offices into one place. Students create an account with an email address and password, provide profile details such as their major and nationality, and use a guide that supports multiple languages.

Students can save their current journey stage, manage personal checklists, and generate three AI-powered suggested next steps. They can also simulate course registration, track registered credits, organize a semester plan, and prepare notes for advising. The built-in chat assistant provides predefined resource responses; the separate journey planner uses Google Gemini to generate suggestions.

This is a student prototype, not an official BYU registration or advising system.

## Main Features

- **Welcome and account access:** explore resources, create an account, and sign in using email and password through Supabase Auth.
- **Home:** view profile information, action items, current journey stage, and advising contact information.
- **Journey map:** explore six standard stages, save a current stage, check off tasks, and add personal tasks or stages.
- **AI next-step planner:** generate three suggested actions based on the saved standard journey stage, with official resource links.
- **Profile and academics:** browse sample courses for Information Systems, Accounting, and Biology; register for or drop Demo Term courses; and see registered credits update.
- **Personal planning tools:** organize a semester plan, track academic milestones, and save advising questions and notes.
- **Resource hub:** explore official BYU resources by topic through an interactive map.
- **About and feedback:** learn about the project and submit feedback.

### Data Persistence and Prototype Limits

- Student profiles, the selected current journey stage, and demo course enrollments are stored in Supabase.
- Registered credits include all saved Demo Term enrollments, including courses selected under a previous major.
- Journey checklists, custom stages, semester plans, milestones, and advising notes are stored in the browser for that account. They do not automatically sync across devices or browsers.
- The AI planner uses the saved standard journey stage. Custom stages and browser-only checklist edits are not sent to Gemini.
- AI suggestions clear when the current stage changes or the student signs out; generated plans are not saved to the database.
- Course registration is a simulation. Students must use MyMap for official BYU registration.
- The appointment-request form opens an email draft. It does not confirm that the email was sent or that an appointment was booked.
- AI suggestions may be incomplete. Students should confirm requirements with the relevant BYU office. The tool does not provide legal, immigration, or tax advice.

## ERD

![ERD](Module%205%20ERD.png)

## Data Flow Diagram

### Level 1 — Student Profile and AI Journey Workflow

This diagram covers student profiles, saving the current journey stage, and generating AI suggestions. It does not represent every feature of the website.

![Level 1 student profile and AI journey workflow](images/journey-workflow-level1.png)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML, CSS, and JavaScript |
| Authentication | Supabase Auth |
| Data access | Supabase JavaScript client and REST API |
| Database | PostgreSQL hosted by Supabase |
| AI backend | Vercel Function at `/api/journey-plan` |
| External AI service | Google Gemini API |
| Hosting | Vercel |
| Local development | Node.js 22 or later with `server.js` |
| Browser-only storage | localStorage for personal planning tools |

**Why we chose this:** Supabase provides authentication and a PostgreSQL database that our team can inspect and manage together. Vercel hosts the website and runs the backend function that calls Gemini. Keeping the Gemini API key on the backend prevents it from being included in frontend code.

## AI Workflow Automation

1. The student marks a standard journey stage as their current stage, and the frontend saves it in Supabase.
2. The student clicks **Generate my next steps**.
3. The frontend sends a request and the student's session token to the Vercel function.
4. The function verifies the student's identity through Supabase Auth and retrieves their saved stage from the student table.
5. The function sends the selected stage, predefined guidance, and resource names to Google Gemini. It does not send the student's name, email, password, or personal planning notes.
6. Gemini generates three suggested actions. The function validates the response and returns it with resource links from the application's curated list.
7. The frontend displays the suggestions and links. The workflow does not automatically register courses, book appointments, or complete tasks.

## How to Run Locally

### Requirements

- Node.js 22 or later
- Git
- Access to the team's configured Supabase project

### Setup

1. Clone the repository and enter the application folder. The application is nested inside the repository:

   ```bash
   git clone https://github.com/msaku3/byu-navigator.git
   cd byu-navigator/byu-navigator
   ```

   Confirm that this folder contains `package.json`, `server.js`, and `public/`.

2. Create a `.env` file beside `server.js`:

   ```dotenv
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_publishable_or_anon_key
   ```

   Keep `.env` out of Git. Use a publishable or anon key, not a service-role key. Ask a team member for the shared project configuration. The Supabase configuration in `public/index.html` should point to that same project; the local `.env` does not automatically replace values in the HTML.

3. The team's database tables and sample data already exist in the shared Supabase project. A separate Supabase project requires its own matching schema, data, and access policies.

4. Start the local server:

   ```bash
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000). Stop the server with **Control+C**.

### Testing the AI Feature

The current local `server.js` does not serve `/api/journey-plan`. Test AI generation on a Vercel Preview or the production website. A page-not-found response from that button on localhost does not by itself indicate a problem with the deployed function.

## Vercel Configuration

The Vercel project's Root Directory is `byu-navigator` within the repository.

Configure these environment variables for both Preview and Production:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | URL of the team's Supabase project |
| `SUPABASE_KEY` | Publishable or anon key for that project |
| `GEMINI_API_KEY` | Secret API key used only by the backend function |
| `GEMINI_MODEL` | Gemini model identifier used by the function |

Create a new deployment after changing environment variables. Never commit real secrets or put the Gemini API key in `public/index.html`.

## Verification Checklist

- Create or sign in to a test account and verify the student profile loads.
- Save a current journey stage, refresh, and confirm it remains selected.
- In Vercel Preview or Production, generate three next-step suggestions and check the resource links.
- Change the current stage and confirm the previous AI suggestions clear.
- Register for a Demo Term course, verify the credit total changes, and refresh to confirm persistence.
- Drop the course and confirm the registered list and credit total update.
- Check that personal checklist and planning changes remain after refresh in the same browser.
- Sign out and confirm AI suggestions clear.
- Check navigation, cards, forms, and buttons on desktop and mobile.
