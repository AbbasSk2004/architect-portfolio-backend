import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import testimonialsRoutes from './routes/testimonials.js'
import careerRoutes from './routes/career.js'
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

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.) in development
    if (!origin && process.env.NODE_ENV !== 'production') {
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Log allowed origins on startup
console.log('🌐 Allowed CORS origins:', allowedOrigins)

// Body parsing middleware
// Note: express.json() only parses JSON requests, multer handles multipart/form-data
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

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

