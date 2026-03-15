# NEU LabLog

A web-based laboratory room usage logging system for Nueva Ecija University (NEU). Faculty can record and monitor laboratory room usage through Google sign-in or QR code authentication.

---

## Tech Stack

- **Frontend** — React + Vite, Tailwind CSS
- **Backend** — Supabase (PostgreSQL + Auth)
- **Deployment** — Vercel

---

## How It Works

### Login
- Professors sign in using their **@neu.edu.ph** Google account or by scanning their personal **QR code**
- Admins sign in via Google only
- Sessions persist across page reloads and auto-logout after **5 minutes of inactivity**

### Professor
- Fill in subject, room, date, start time, and end time to log laboratory usage
- The system **prevents double booking** — if a room is already occupied during the requested time, the entry is blocked
- View personal usage history filtered by day, week, month, year, or custom date range
- Each professor has a unique QR code that can be downloaded and used for quick login

### Admin
- View a **live room heatmap** showing which rooms are currently occupied or free
- Add and remove laboratory rooms
- View, search, edit, and delete all usage logs from any professor
- Filter logs by date range and view a usage chart per room

---

## Environment Variables

Create a `.env` file in the root of the project:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Build for production
npm run build
```

---

## Deployment

This project is deployed on **Vercel**.

1. Push the project to GitHub
2. Import the repository in [vercel.com](https://vercel.com)
3. Add the environment variables in Vercel project settings
4. In Supabase → Authentication → URL Configuration, set your Vercel URL as the Site URL and Redirect URL

---

## Database

Two main tables in Supabase:

- **`profiles`** — stores professor and admin accounts, roles, and QR codes
- **`usage_logs`** — stores all laboratory usage records with room, subject, and time details

Row Level Security (RLS) is enabled. Three SECURITY DEFINER functions handle operations that need to work for both Google-login and QR-mode users:

- `safe_insert_usage_log` — conflict check + insert
- `get_professor_logs_by_id` — fetch logs by professor
- `find_professor_by_qr` — QR code login lookup

---

> For authorized NEU faculty use only · @neu.edu.ph accounts only
