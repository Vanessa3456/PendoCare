# Deployment Guide for PendoCare

This guide explains how to deploy the PendoCare application. The frontend will be deployed on **Vercel** and the backend on **Render**.

## Prerequisites

- Accounts on [Vercel](https://vercel.com/) and [Render](https://render.com/).
- A [Supabase](https://supabase.com/) project (database).
- A [Google AI Studio](https://aistudio.google.com/) API Key (Gemini).
- Email credentials (e.g., Gmail App Password) for notifications.

---

## Part 1: Backend Deployment (Render)

We deploy the backend first because the frontend needs the backend URL.

1.  **Push your code** to GitHub/GitLab.
2.  Log in to **Render** and click **New +** -> **Web Service**.
3.  Connect your PendoCare repository.
4.  **Configure the Service:**
    -   **Name:** `pendocare-api` (or similar)
    -   **Root Directory:** `server` (Important!)
    -   **Environment:** Node
    -   **Build Command:** `npm install`
    -   **Start Command:** `node index.js`
    -   **Plan:** Free

5.  **Environment Variables** (Click "Advanced" or "Environment" tab):
    Add the following variables based on your `server/.env` file:
    -   `NODE_ENV`: `production`
    -   `SUPABASE_URL`: (Your Supabase URL)
    -   `SUPABASE_KEY`: (Your Supabase Service Role or Anon Key)
    -   `GEMINI_API_KEY`: (Your Google Gemini API Key)
    -   `EMAIL_HOST`: `smtp.gmail.com` (or your provider)
    -   `EMAIL_PORT`: `587`
    -   `EMAIL_USER`: (Your email address)
    -   `EMAIL_PASS`: (Your email app password)
    -   `JWT_SECRET`: (A long random string)
    -   `CLIENT_URL`: `https://your-frontend-project.vercel.app` (You will update this *after* deploying the frontend, for now you can put `*` or leave it blank if CORS allows).

6.  Click **Create Web Service**.
7.  Wait for the deployment to finish. **Copy the backend URL** (e.g., `https://pendocare-api.onrender.com`).

---

## Part 2: Frontend Deployment (Vercel)

1.  Log in to **Vercel** and click **Add New...** -> **Project**.
2.  Import your PendoCare repository.
3.  **Configure the Project:**
    -   **Framework Preset:** Vite (should be detected automatically).
    -   **Root Directory:** Click "Edit" and select `client`.
4.  **Environment Variables:**
    -   `VITE_API_URL`: Paste the **Render Backend URL** from Part 1 (e.g., `https://pendocare-api.onrender.com/api`).
        *Note: Ensure you add `/api` at the end if that is how your backend routes are set up (which they are).*

5.  Click **Deploy**.
6.  Once deployed, Vercel will give you a domain (e.g., `https://pendocare-frontend.vercel.app`).

---

## Part 3: Final Configuration

1.  Go back to your **Render Dashboard** -> `pendocare-api` -> **Environment**.
2.  Update `CLIENT_URL` to match your new Vercel domain (e.g., `https://pendocare-frontend.vercel.app`). This ensures CORS works correctly.
3.  Save changes. Render will redeploy automatically.

**Congratulations! Your app is now live.**
