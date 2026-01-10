import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import testimonialsRoutes from './routes/testimonials.js'
import careerRoutes from './routes/career.js'
import inquiriesRoutes from './routes/inquiries.js'
import stripeRoutes from './routes/stripe.js'
import billingRoutes from './routes/billing.js'
import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/dashboard.js'
import adminTestimonialsRoutes from './routes/adminTestimonials.js'
import adminCareerRoutes from './routes/adminCareer.js'
import adminProjectsRoutes from './routes/adminProjects.js'
import projectsRoutes from './routes/projects.js'
import { connectToDatabase } from './config/database.js'
import { requestLogger } from './middleware/logger.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Configure CORS with multiple allowed origins
function getAllowedOrigins() {
  const origins = []
  
  // Always allow local frontend for development
  origins.push('http://localhost:3000')
  
  // Add frontend URLs from environment variable (comma-separated)
  if (process.env.FRONTEND_URLS) {
    const envUrls = process.env.FRONTEND_URLS.split(',').map(url => url.trim())
    origins.push(...envUrls)
  } else if (process.env.FRONTEND_URL) {
    // Support single URL for backward compatibility
    origins.push(process.env.FRONTEND_URL)
  }
  
  // In production (Render), also allow Vercel frontend
  if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    origins.push('https://architecture-portfolio-mu.vercel.app')
  }
  
  // Remove duplicates
  return [...new Set(origins)]
}

const allowedOrigins = getAllowedOrigins()

// Stripe webhook route must be BEFORE CORS middleware
// (Stripe webhooks don't send Origin header, so they need special handling)
import { handleWebhook } from './controllers/stripeController.js'
app.post('/api/stripe/webhook', 
  // Skip CORS check for webhook - it's server-to-server from Stripe
  (req, res, next) => {
    // Allow webhook requests without Origin header
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'POST')
    res.header('Access-Control-Allow-Headers', 'Stripe-Signature, Content-Type')
    next()
  },
  express.raw({ type: 'application/json' }), 
  handleWebhook
)

// CORS configuration for all other routes
// Note: GET requests without origin are allowed (read-only, less risky)
// This handles server-side requests from Next.js, health checks, etc.
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin in development (for testing tools)
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true)
    }
    
    // In production, allow requests without origin
    // GET requests are read-only and safe
    // POST/PUT/DELETE without origin will be handled by route-level validation
    // This prevents blocking legitimate server-side requests from Next.js
    if (!origin && process.env.NODE_ENV === 'production') {
      // Allow it - the route handlers will validate the request
      return callback(null, true)
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.warn(`⚠️  Blocked CORS request from: ${origin}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Log allowed origins on startup
console.log('🌐 Allowed CORS origins:', allowedOrigins)

// Body parsing middleware
// Note: express.json() only parses JSON requests, multer handles multipart/form-data
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Request logging middleware
app.use(requestLogger)

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  })
})

// API Routes
app.use('/api/testimonials', testimonialsRoutes)
app.use('/api/career', careerRoutes)
app.use('/api/inquiries', inquiriesRoutes)
app.use('/api/stripe', stripeRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api/admin/auth', authRoutes)
app.use('/api/admin/dashboard', dashboardRoutes)
app.use('/api/admin/testimonials', adminTestimonialsRoutes)
app.use('/api/admin/career', adminCareerRoutes)
app.use('/api/admin/projects', adminProjectsRoutes)
app.use('/api/projects', projectsRoutes)

// 404 handler (must be after all routes)
app.use(notFound)

// Error handler (must be last)
app.use(errorHandler)

// Start server
async function startServer() {
  try {
    // Connect to database with retry logic
    let retries = 3
    let connected = false
    
    while (retries > 0 && !connected) {
      try {
        await connectToDatabase()
        connected = true
      } catch (error) {
        retries--
        if (retries > 0) {
          console.log(`⚠️  Database connection failed. Retrying in 3 seconds... (${retries} attempts left)`)
          await new Promise(resolve => setTimeout(resolve, 3000))
        } else {
          console.error('❌ Failed to connect to database after multiple attempts')
          throw error
        }
      }
    }
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`)
      console.log(`📡 API endpoints available at http://localhost:${PORT}/api`)
      console.log(`🌐 Allowed CORS origins: ${allowedOrigins.join(', ')}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    console.error('\n💡 Troubleshooting tips:')
    console.error('   1. Check your MongoDB Atlas connection string in .env')
    console.error('   2. Verify your IP is whitelisted in MongoDB Atlas Network Access')
    console.error('   3. Check if your MongoDB password contains special characters (may need URL encoding)')
    console.error('   4. Ensure your internet connection is stable')
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server')
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server')
  process.exit(0)
})

startServer()

