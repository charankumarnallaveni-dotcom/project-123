# PLACEMEIN CRM - Deployment Guide

This project is configured to deploy with **Vercel** for the Frontend and **Render** for the Backend from the single GitHub repository: `Aravindlakki/project-123`.

| Service   | Platform | URL |
|-----------|----------|-----|
| Frontend  | Vercel   | https://project-123-bice.vercel.app |
| Backend   | Render   | https://project-123-2.onrender.com |

---

## 1. Backend Deployment on Render (Web Service)

1. Go to [render.com](https://render.com/) and sign in.
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository (`Aravindlakki/project-123`).
4. Configure the settings:
   - **Name**: `project-123-2`
   - **Language**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Under **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `SECRET_KEY` = (any random secure secret string)
   - `GEMINI_API_KEY` = *(Optional: your Gemini API key)*
   - `FRONTEND_URL` = `https://project-123-bice.vercel.app`
6. Click **Create Web Service**.

> **Note**: Test your backend health check by visiting:
> `https://project-123-2.onrender.com/api/health`

---

## 2. Frontend Deployment on Vercel

1. Go to [vercel.com](https://vercel.com/) and sign in.
2. Click **Add New...** > **Project**.
3. Import your GitHub repository.
4. Vercel will automatically detect `Vite` thanks to `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build:frontend` (auto-set by vercel.json)
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - **`VITE_API_URL`**: `https://project-123-2.onrender.com`
   - **`VITE_BASE_PATH`**: `/`
6. Click **Deploy**.
7. Your app is live at `https://project-123-bice.vercel.app`!

---

## 3. How the Architecture Works Together

- **Dynamic Routing**: The frontend automatically routes all API requests (`/auth/login`, `/worksheet`, `/crm`, `/jds`, etc.) to your Render backend via `VITE_API_URL`.
- **CORS Pre-Configured**: The Express backend in `server.ts` is configured with credentials and origin reflection for all `*.vercel.app` and custom domains.
- **Resilient Fallback**: Even if the Render free-tier backend is cold-starting (or waking up after inactivity), the frontend client-side store allows immediate offline usage and credential matching without breaking the UI.
- **SPA Routing**: `vercel.json` rewrites handle client-side refreshes seamlessly without 404s.

