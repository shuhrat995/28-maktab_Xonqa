import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Load environment variables
dotenv.config();

const DEFAULT_JWT_SECRET = 'school-website-secret-key-2024';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import database
import { loadDatabase, saveDatabase } from './config/database.js';

// Import routes
import authRoutes, { createInitialAdmin } from './routes/auth.js';
import contentRoutes from './routes/content.js';
import queueRoutes from './routes/queue.js';
import settingsRoutes from './routes/settings.js';
import teacherRoutes from './routes/teachers.js';
import sectionRoutes from './routes/sections.js';
import studentRoutes from './routes/students.js';
import contactRoutes from './routes/contact.js';
import adminRoutes from './routes/admin.js';
import staffRoutes from './routes/staff.js';
import { seedDefaultPageContent } from './controllers/sectionController.js';
import { seedDefaultStaff } from './controllers/staffController.js';

// Import queue processing
import { getPendingQueueItems, processQueueItem } from './utils/queue.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
app.set('trust proxy', 1);
app.disable('x-powered-by');
const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = Array.from(new Set([
  process.env.CORS_ORIGINS,
  process.env.ALLOWED_ORIGINS,
  process.env.FRONTEND_URL,
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001'
].filter(Boolean)
  .flatMap((value) => value!.split(','))
  .map((origin) => origin.trim())
  .filter(Boolean)));

app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", ...allowedOrigins],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  permittedCrossDomainPolicies: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser tools and server-to-server requests
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'Cache-Control']
}));
app.use(cookieParser());

// Rate limiting (separated for read/write/auth to reduce false 429 on public pages)
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000');
const GENERAL_RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX_REQUESTS;
const AUTH_RATE_LIMIT_WINDOW_MS = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || process.env.RATE_LIMIT_WINDOW_MS || '900000');
const READ_MAX = parseInt(process.env.RATE_LIMIT_READ_MAX || GENERAL_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? '4000' : '50000'));
const WRITE_MAX = parseInt(process.env.RATE_LIMIT_WRITE_MAX || GENERAL_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? '800' : '10000'));
const AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX || process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'production' ? '40' : '500'));

const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: (req) => (req.method === 'GET' ? READ_MAX : WRITE_MAX),
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health'
});

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_MAX,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/auth/login', authLimiter);
app.use('/api/', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files - CRITICAL: Must be before API routes
const UPLOAD_DIR = path.join(__dirname, '../uploads');
console.log('📁 Uploads directory:', UPLOAD_DIR);
console.log('📁 Directory exists:', fs.existsSync(UPLOAD_DIR));

app.use('/uploads', (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
}, express.static(UPLOAD_DIR, {
  setHeaders: (res, path) => {
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Cache-Control', 'no-cache');
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).json({ error: 'Route not found' });
});

// Scheduled task: Process offline queue every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Processing offline queue...');
  try {
    const items = getPendingQueueItems();
    if (items.length > 0) {
      console.log(`Found ${items.length} pending items in queue`);
      for (const item of items) {
        const success = processQueueItem(item);
        console.log(`Item ${item.id}: ${success ? 'success' : 'failed'}`);
      }
    }
  } catch (error) {
    console.error('Queue processing error:', error);
  }
});

// Start server
async function startServer() {
  try {
    if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET)) {
      throw new Error('JWT_SECRET must be set to a strong custom value in production.');
    }

    loadDatabase();
    console.log('✅ Database loaded');
    await createInitialAdmin();
    seedDefaultPageContent();
    seedDefaultStaff();
    
    app.listen(PORT, () => {
      console.log(`\n✅ Backend server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📁 Uploads: http://localhost:${PORT}/uploads/`);
      console.log(`🔐 Admin login: POST http://localhost:${PORT}/api/auth/login`);
      console.log(`\nAdmin credentials are loaded from environment variables.`);
      console.log(`   Username: ${process.env.ADMIN_USERNAME || 'admin'}`);
      console.log(`   Password: [hidden]`);
      console.log(`   Tip: set a strong ADMIN_PASSWORD and JWT_SECRET in backend/.env\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

startServer();

export default app;
