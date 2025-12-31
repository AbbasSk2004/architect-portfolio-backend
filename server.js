import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import testimonialsRoutes from './routes/testimonials.js'
import { connectToDatabase } from './config/database.js'
import { requestLogger } from './middleware/logger.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}))

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
      console.log(`🌐 Frontend URL: ${FRONTEND_URL}`)
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

