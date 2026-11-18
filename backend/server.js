require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { admin } = require('./config/firebase');

// Register all Mongoose models eagerly for population
require('./models/User');
require('./models/Ward');
require('./models/Department');
require('./models/Complaint');
require('./models/Notification');
require('./models/AuditLog');
const complaintRoutes = require('./routes/complaintRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const masterRoutes = require('./routes/masterRoutes');
const staffRoutes = require('./routes/staffRoutes');
const workflowRoutes = require('./routes/workflowRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''));

// Trust proxy for secure cookies / HTTPS detection behind reverse proxies
app.set('trust proxy', 1);

// Ensure uploads directory exists
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 1. Database Connection
connectDB();

// 2. Core Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman), matching allowed client origins, or any Vercel domain
      if (
        !origin ||
        CLIENT_ORIGINS.includes('*') ||
        CLIENT_ORIGINS.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Allow gracefully across cloud domains
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Static Asset Serving (Fallback for locally stored pictures)
app.use('/uploads', express.static(uploadsDir));

// 4. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// 5. Health & Diagnostic Route
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      server: 'running',
      database: dbStates[dbStatus] || 'unknown',
      firebase: admin ? 'initialized' : 'uninitialized',
      cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'unconfigured',
      aiMicroserviceUrl: process.env.AI_MICROSERVICE_URL || 'http://127.0.0.1:8000',
    },
  });
});

// Root welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Civic Issue Reporting Platform Backend API',
    version: '1.1.0',
    documentation: {
      preview: 'POST /api/complaints/preview',
      submit: 'POST /api/complaints/submit',
      updateStatus: 'PATCH /api/complaints/:id/status',
      userComplaints: 'GET /api/complaints/my',
      areaComplaints: 'GET /api/complaints/area',
      stats: 'GET /api/complaints/stats',
      notifications: 'GET /api/notifications',
      markNotificationRead: 'PATCH /api/notifications/:id/read',
      markAllNotificationsRead: 'PATCH /api/notifications/read-all',
      clearAllNotifications: 'DELETE /api/notifications/clear-all',
      adminCreateOfficer: 'POST /api/admin/officers',
      adminListOfficers: 'GET /api/admin/officers',
      adminDeleteOfficer: 'DELETE /api/admin/officers/:uid',
      adminStats: 'GET /api/admin/stats',
      adminComplaints: 'GET /api/admin/complaints',
      adminUpdateTicketStatus: 'PATCH /api/admin/complaints/:id/status',
      health: 'GET /health',
    },
  });
});

// 6. 404 Route Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// 7. Global Centralized Error Handler
app.use((err, req, res, next) => {
  console.error(`[Error Handler] ${err.name || 'Error'}: ${err.message}`);

  // Multer-specific errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file is too large. Maximum allowed size is 10MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages,
    });
  }

  // Mongoose CastError (e.g., invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid resource identifier: ${err.value}`,
    });
  }

  // Default internal server error
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// 8. Server Startup
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(` Civic Backend Orchestrator listening on :${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Client Origin(s): ${CLIENT_ORIGINS.join(', ')}`);
    console.log(` Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME || 'None'}`);
    console.log(` AI Microservice: ${process.env.AI_MICROSERVICE_URL || 'http://127.0.0.1:8000'}`);
    console.log(`=============================================`);
  });
}

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('\n[Server] Received shutdown signal. Closing HTTP server and database connections...');
  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('[Server] Connections closed. Exiting process.');
      process.exit(0);
    } catch (err) {
      console.error('[Server] Error closing database connection:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = app;
