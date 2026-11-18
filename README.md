# BYU Navigator

## App Summary

Newly admitted international students at BYU have to piece together information about applying, housing, classes, work, and taxes from many different offices and websites. That information is often scattered, written for students already on campus, and only available in English, which makes the transition to BYU stressful and confusing. BYU Navigator is a central hub that guides international students through each stage of their BYU experience, from applying all the way to graduation. Students create an account with their NetID, follow a step-by-step journey map with action items and official resources for each stage, and can ask a built-in assistant questions along the way. The app also supports multiple languages so students can read guidance in the language they're most comfortable with. Our goal is to help international students feel prepared and less overwhelmed, one step at a time.

## ERD

![ERD](Module%205%20ERD.png)

## Data Flow Diagrams

These diagrams show account access, student profiles, simulated course
registrations, saved journey stages, and AI-generated next steps.
Course registrations are simulations for Demo Term.

### Level 0 — Context Diagram

The entire application is represented as one process. Supabase Auth
and Google Gemini are external services. Internal database tables
are shown in Level 1.

```mermaid
flowchart TD
    U["Student"]
    P("0. BYU Navigator")
    A["Supabase Auth"]
    G["Google Gemini API"]

    U -->|"Account details, login credentials, profile changes, course selections, stage selection, plan request"| P
    P -->|"Account status, profile, course lists, registered credits, journey guidance, suggested actions"| U

    P -->|"Signup details, login credentials, session verification data"| A
    A -->|"Authentication result and verified user identity"| P

    P -->|"Selected stage, curated guidance, resource names"| G
    G -->|"Three generated suggested actions"| P
```

### Level 1 — Main Processes

The application is divided into four processes. Database tables are
shown as logical data stores, even though Supabase hosts them.
The AI journey process runs through a Vercel backend function.

```mermaid
flowchart TD
    U["Student"]
    A["Supabase Auth"]
    G["Google Gemini API"]

    P1("1.0 Authenticate student")
    P2("2.0 Manage student profile")
    P3("3.0 Manage demo registrations")
    P4("4.0 Generate journey guidance")

    D1[("D1 Student profiles")]
    D2[("D2 Majors and course catalog")]
    D3[("D3 Demo enrollments")]

    U -->|"Account details and login credentials"| P1
    P1 -->|"Account status"| U
    P1 -->|"Signup details, login credentials, session verification data"| A
    A -->|"Authentication result and verified user identity"| P1

    P1 -->|"Verified identity and signup profile details"| P2
    P1 -->|"Authenticated session"| P3
    P1 -->|"Authenticated session"| P4

    U -->|"Profile changes"| P2
    P2 -->|"Student profile"| U
    P2 -->|"New or updated profile"| D1
    D1 -->|"Saved profile"| P2
    D2 -->|"Major options"| P2

    U -->|"Course selections"| P3
    D1 -->|"Student ID and selected major"| P3
    D2 -->|"Courses, groups, and credits"| P3
    D3 -->|"Saved registrations"| P3
    P3 -->|"New registration"| D3
    P3 -->|"Registration removal criteria"| D3
    P3 -->|"Course lists and registered credits"| U

    U -->|"Stage selection and plan request"| P4
    P4 -->|"Updated current stage"| D1
    D1 -->|"Saved current stage"| P4
    P4 -->|"Selected stage, curated guidance, resource names"| G
    G -->|"Three generated suggested actions"| P4
    P4 -->|"Journey guidance and suggested actions"| U
```

The AI workflow uses the student's saved stage to generate suggestions.
It sends stage guidance and resource names to Gemini, rather than
student names, email addresses, or passwords. Official resource links
come from the application's curated list.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML, CSS, and JavaScript |
| Backend | Supabase (backend as a service) |
| Database | PostgreSQL, hosted by Supabase |
| Hosting | opened locally in the browser |

**Why we chose this:** We chose Supabase because it gives us a real PostgreSQL database without having to build and host our own server. Its Table Editor lets everyone on the team see and edit our tables directly, which made it easy to check that our button was actually saving data. It also has a free tier and a JavaScript library that connects straight from our frontend, which kept setup simple for a team with mixed experience.

## How to Get It Running
1. Clone the repository:
```
   git clone https://github.com/msaku3/byu-navigator.git
   cd byu-navigator
```
2. Create a `.env` file in the project root with:
```
   SUPABASE_URL=your_project_url
   SUPABASE_ANON_KEY=your_anon_key
```
This file is listed in `.gitignore` and is not in the repo. Ask a team member for the values, or find them in Supabase under **Project Settings → API**.
3. The database tables and sample data already live in our Supabase project, so no database setup is needed.
4. Open `BYU Navigator – Prototype.html` in Google Chrome.
