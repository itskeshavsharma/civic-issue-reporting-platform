# 🏛️ Civic Issue Reporting Platform — Citizen Frontend

[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.3.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase_Auth%20&%20FCM-12.19.0-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)

An AI-powered civic issue reporting and tracking web application designed for citizens. Empowering communities to report urban infrastructure problems (potholes, garbage dumps, broken streetlights, waterlogging, etc.) with automatic AI vision analysis, multilingual descriptions, GPS location tagging, real-time push notifications, and progressive grievance resolution tracking.

---

## ✨ Key Features

### 1. 🤖 Two-Stage AI Vision & Multimodal Inspection
- **Stage 1 (Fast Inspection):** Citizens upload an image of the civic issue; the platform sends it to the multimodal AI pipeline (Florence-2 + FLAN-T5) to instantly detect the problem, draw **visual bounding boxes**, and generate **dual-language descriptions** in both English and Hindi.
- **Stage 2 (Confirmation & Cloudinary Persistence):** Citizens review, edit the text if needed, set location coordinates, and submit. The backend streams images directly to Cloudinary and registers the device FCM push token.

### 2. 🔔 Firebase Cloud Messaging (FCM) Web Push Notifications
- Background service worker (`public/firebase-messaging-sw.js`) handles native push alerts even when the browser tab is idle.
- Foreground message listener (`onMessage`) dispatches instant alert banners and badge counter updates.
- Proactive permission requests on application launch.

### 3. 🛎️ In-App Notification Bell & Slide-Over Drawer
- Topbar navigation notification bell with real-time unread badge counter.
- Interactive slide-over drawer showing chronological updates with icons for each ticket stage.
- Actions for **Mark as Read**, **Mark All as Read**, **Clear All**, and one-click redirection to `/my-complaints`.

### 4. 📋 "My Complaints" Multi-Tier Tab Filtering
- Real-time status breakdown tabs with accurate live count badges:
  - **All Complaints**
  - **Submitted** (`Submitted`, `Assigned to Ward`, `Pending`)
  - **Under Working** (`In Progress`, `Assigned`, `Under Working`, `Reopened`)
  - **Resolved (To Verify)** (`Resolved` awaiting verification)
  - **Closed** (`Closed` completed tickets)
- Instant client-side fallback filtering ensuring zero UI count mismatch.

### 5. 📸 Progressive Complaint Cards (Before vs. After)
- **State 1: 'Submitted / Pending Review'** — Displays reported hazard photo with AI bounding box defect overlay.
- **State 2: 'Under Working'** — Displays horizontal timeline progress indicator (`Reported` ➔ `Team Assigned` ➔ `In Progress ⏳` ➔ `Resolution`), official department remarks, and on-site field team photos.
- **State 3: 'Resolved'** — Interactive toggle for **"View Before vs. After Proof 📸"** side-by-side comparison grid with municipal verification badge and optional "Reopen Issue" action.

---

## ⚙️ Environment Variables Setup (`.env`)

Create `frontend-user/.env` with your Firebase Web SDK and API settings:

```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_VAPID_KEY=your_fcm_web_push_vapid_key_pair_here
```

---

## 🚀 Quick Start & Installation

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev

# 3. Production build
npm run build
npm run preview
```
Portal runs at: **`http://localhost:5173`**
