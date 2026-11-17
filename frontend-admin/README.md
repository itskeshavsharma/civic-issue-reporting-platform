# 🏛️ Civic Municipal Issue Management System — Admin Web Portal

Enterprise-grade Municipal Administration Portal for the **Civic Issue Management System**. Built with **React 19**, **Tailwind CSS v4**, **React Router v6**, **Lucide Icons**, and **React-Leaflet v5**.

---

## 🏛️ Roles & Permissions Architecture (RBAC)

The portal provides an operational hierarchy with role-based access:

| Role | Title | Scope & Authority | Accessible Routes |
| :--- | :--- | :--- | :--- |
| `super_admin` | **City Head / IT Admin** | Full city oversight across all wards, filter by any ward, manage officer accounts & revoke credentials. | `/admin/dashboard`<br>`/admin/map`<br>`/admin/complaints`<br>`/admin/officers` |
| `managing_officer` | **Managing Officer** | Citywide Strategic Triage. View all wards, reassign complaints between wards, escalate tickets upward, modify ticket severity, leave supervisory comments. | `/admin/dashboard`<br>`/admin/map`<br>`/admin/complaints`<br>*(Blocked from `/admin/officers`)* |
| `ward_officer` | **Ward Officer** | Ward-Level Supervision. Supervise complaints in assigned ward, triage severity levels, dispatch to field crews, post official remarks. | `/admin/dashboard`<br>`/admin/map`<br>`/admin/complaints`<br>*(Blocked from `/admin/officers`)* |
| `field_officer` | **Field Crew / Worker** | On-Site Execution. Set status to `In Progress`, upload on-site progress photos, upload resolution proof photos, and mark tickets as `Resolved`. | `/admin/dashboard`<br>`/admin/map`<br>`/admin/complaints`<br>*(Blocked from `/admin/officers`)* |

---

## 🗺️ Leaflet GIS Map Console (`/admin/map`)

- **Citywide Spatial View:** Full city map view accessible to Managing, Ward, and Field Officers for situational awareness.
- **Severity Teardrop Markers:**
  - 🔴 **Red:** `CRITICAL` severity hazards (animated pulse effect).
  - 🟠 **Orange:** `HIGH` severity issues.
  - 🟡 **Amber/Yellow:** `MEDIUM` severity issues.
  - 🔵 **Blue:** `LOW` severity issues.
  - 🟢 **Green:** `Resolved Archive` complaints.
- **Dynamic Density Hotspots:** Automatic red semi-transparent circular overlays highlight dense problem zones with high complaint frequency.
- **Direct Navigation:** Click **"Locate on Map"** from the complaints table to instantly center and zoom to that exact ticket.

---

## ⚙️ Environment Variables Setup (`.env`)

Create `frontend-admin/.env` with your Firebase Web SDK and API settings:

```env
VITE_API_URL=http://localhost:5000
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Portal runs at: **`http://localhost:5174/admin`**

### 3. Production Build
```bash
npm run build
npm run preview
```

---

## 📁 Source Code Structure

```
frontend-admin/
├── src/
│   ├── components/admin/
│   │   ├── AdminHeader.jsx          # Municipal navigation bar, role badge, user switcher
│   │   ├── AdminSidebar.jsx         # Navigation sidebar links
│   │   └── InspectorModal.jsx       # Complaint inspection modal, proofs, status updater
│   ├── config/
│   │   └── firebase.js              # Firebase Web SDK initialization
│   ├── context/
│   │   └── AuthContext.jsx          # RBAC claims inspection, role switching & session state
│   ├── pages/admin/
│   │   ├── Dashboard.jsx            # KPI cards, severity distribution & recent complaints
│   │   ├── MapConsole.jsx           # Leaflet GIS console with teardrop pins & hotspots
│   │   ├── ComplaintsTable.jsx      # Filterable & searchable grievance management table
│   │   ├── ManageOfficers.jsx       # Officer hierarchy creation & ward assignment
│   │   └── ResolvedArchive.jsx      # Historical archive of verified resolved issues
│   ├── routes/
│   │   └── AdminRoute.jsx           # Protected route guard enforcing RBAC authority
│   ├── services/
│   │   └── api.js                   # Axios client with automatic Bearer token injection
│   └── App.jsx                      # Route definitions
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
└── vite.config.js                   # Vite configuration
```

---

## 👥 Officer Hierarchy & Account Management (`/admin/officers`)

Super Admins have full authority to create, configure, update, and manage all municipal staff accounts directly from the Web UI:

### 1. Initial Login as Super Admin
1. Navigate to: **`http://localhost:5174/admin/login`**
2. Sign in with the bootstrapped Super Admin credentials (created via `backend/scripts/initSuperAdmin.js`):
   - **Default Email:** `admin@municipal.gov.in`
   - **Default Password:** `CivicAdmin@2026`

### 2. Creating Municipal Officers via Web UI
Navigate to **Manage Officers** (`/admin/officers`) from the sidebar:
- **Available Roles:**
  1. **Managing Officer (`managing_officer`):** Citywide supervisory privileges across all wards.
  2. **Ward Officer (`ward_officer`):** Ward-level dispatch and ticket supervision.
  3. **Field Officer (`field_officer`):** On-site repair crew, uploads fix proof and changes status.
- **Required Details:**
  - Full Name & Official Email
  - Initial Password (minimum 6 characters)
  - Assigned Ward (select assigned ward or "All Wards" for Managing Officer)
  - Department (Roads, Sanitation, Water Supply, Electricity, Horticulture)
  - Mobile Number

### 3. Modifying & Deactivating Officer Accounts
- **Toggle Leave / Active Status:** Change officer operational status to ensure tickets are not routed to officers on leave.
- **Delete / Revoke Credentials:** Instantly revoke access and delete the officer from Firebase Auth and MongoDB.
- **Resetting Passwords:** Can be executed via the backend CLI tool:
  ```bash
  cd backend && node scripts/resetPassword.js <officer_email> <new_password>
  ```

