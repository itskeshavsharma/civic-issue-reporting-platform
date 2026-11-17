# 🏛️ Civic Issue Reporting Platform — Backend Orchestrator

Production-ready, modular **Node.js + Express + MongoDB** backend adhering to strict **MVC Architecture** for the **Civic Issue Reporting & Municipal Management Platform**.

This orchestrator connects:
1. **Citizen Portal (`frontend-user` :5173)**: Issue reporting, camera image streams, push token registration, and status tracking.
2. **Municipal Admin Portal (`frontend-client` :5174)**: Role-based triage, GIS coordinates query, officer management, and proof verification.
3. **Cloudinary CDN**: Cloud image storage pipeline for hazard photos, field progress photos, and resolution proofs.
4. **FastAPI AI Microservice (`micro-service` :8000)**: Florence-2 vision grounding, FLAN-T5 title normalization, and 384-D dense embeddings.
5. **MongoDB Spatial Database**: High-performance spatial indexing (`2dsphere`), compound indexes, and semantic vector similarity.
6. **Firebase Admin SDK**: Bearer ID token verification, user role claims, and FCM multicast push notifications.

---

## 📁 MVC Project Architecture

```
backend/
├── config/
│   ├── db.js                     # MongoDB connection logic with autoIndex & retry handlers
│   └── firebase.js               # Firebase Admin SDK initialization using serviceAccountKey.json
├── controllers/
│   ├── complaintController.js    # Citizen logic (preview, submit, spatial deduplication, reopen)
│   ├── adminController.js        # Municipal logic (citywide GIS, ward triage, proof upload, officer auth)
│   └── notificationController.js # In-app notification management (fetch, mark read, clear)
├── middleware/
│   ├── authMiddleware.js         # Firebase Bearer token verification & user context injection
│   └── uploadMiddleware.js       # Multer memory storage configuration (10MB image limit)
├── models/
│   ├── Complaint.js              # Mongoose schema (2dsphere index, fcmTokens, proofs, timeline)
│   ├── Officer.js                # Municipal officer schema with RBAC roles & assigned wards
│   └── Notification.js           # In-app notification history schema with compound indexes
├── routes/
│   ├── complaintRoutes.js        # Express routes for citizen endpoints (/api/complaints)
│   ├── adminRoutes.js            # Express routes for administrative endpoints (/api/admin)
│   └── notificationRoutes.js     # Express routes for notifications (/api/notifications)
├── utils/
│   ├── cloudinary.js             # Cloudinary v2 stream upload utility for memory buffers
│   ├── notificationService.js    # FCM multicast push dispatcher & in-app notification logger
│   └── vectorMath.js             # Cosine similarity calculation for 384-D semantic vectors
├── tests/
│   ├── vectorMath.test.js        # Cosine similarity mathematical accuracy tests
│   ├── model.test.js             # Mongoose schema and index definition tests
│   └── api.test.js               # HTTP endpoints, health check & auth tests
├── .env.example                  # Environment configuration template
├── .gitignore                    # Ignored files (node_modules, .env, serviceAccountKey.json)
├── package.json                  # Dependencies and scripts
└── server.js                     # Server entrypoint, CORS policies, logging & health endpoints
```

---

## 🔌 API Endpoint Specifications

### 1. Citizen Endpoints (`/api/complaints`)
| Method | Route | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/complaints/preview` | Required | Forwards raw image to AI microservice; returns defect bounding box & dual-language summaries. |
| `POST` | `/api/complaints` | Required | Uploads complaint image to Cloudinary, executes spatial deduplication, persists ticket in MongoDB. |
| `GET` | `/api/complaints/my` | Required | Retrieves authenticated citizen's complaints with breakdown counts (`Submitted`, `Under Working`, `Resolved`, `Closed`). |
| `GET` | `/api/complaints/:id` | Required | Fetches detailed ticket data with chronological audit timeline and proof photos. |
| `POST` | `/api/complaints/:id/reopen` | Required | Allows citizen to reopen an unsatisfactorily resolved complaint with feedback comments. |

### 2. Municipal Administrative Endpoints (`/api/admin`)
| Method | Route | Auth & Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/complaints` | Staff | Returns complaints list. Supports `view=map` for citywide GIS pins without ward filtering. |
| `PATCH` | `/api/admin/complaints/:id/status` | Staff | Updates ticket status (`Assigned`, `In Progress`, `Resolved`, `Closed`). Field officers upload work/resolution proofs. |
| `PATCH` | `/api/admin/complaints/:id/reassign` | Managing/Super | Reassigns ticket to a different ward or field team. |
| `GET` | `/api/admin/officers` | Super Admin | Lists all registered municipal officers and their assigned roles/wards. |
| `POST` | `/api/admin/officers` | Super Admin | Creates new municipal officer account in MongoDB and Firebase Auth. |
| `GET` | `/api/admin/ward-options` | Staff | Returns list of configured city wards. |
| `GET` | `/api/admin/hierarchy-officers` | Staff | Returns available managing, ward, and field officers for assignment dispatch. |

### 3. Notification Endpoints (`/api/notifications`)
| Method | Route | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Required | Retrieves user's in-app notifications with unread count. |
| `PATCH` | `/api/notifications/:id/read` | Required | Marks a single notification as read. |
| `PATCH` | `/api/notifications/read-all` | Required | Marks all notifications as read. |
| `DELETE` | `/api/notifications/clear` | Required | Clears notification history. |

---

## ⚙️ Environment Variables (`.env`)

Create `backend/.env` with the following keys:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/civic_db
AI_MICROSERVICE_URL=http://127.0.0.1:8000
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_URL=cloudinary://your_api_key:your_api_secret@your_cloud_name
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174
DEDUPLICATION_RADIUS_METERS=200
```

---

## 🚀 Running the Backend

```bash
# Install dependencies
npm install

# Run unit and integration tests
npm test

# Start development server with auto-reload
npm run dev

# Start production server
npm start
```
- Health Check: `http://localhost:5000/health`
