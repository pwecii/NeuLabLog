# NEU LabLog

A web-based laboratory room usage logging system for New Era University (NEU). Faculty can record and monitor laboratory room usage through Google sign-in or QR code authentication.

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




> For authorized NEU faculty use only · @neu.edu.ph accounts only
