import { MongoClient, ServerApiVersion } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const uri = process.env.MONGODB_URI

if (!uri) {
  throw new Error('MONGODB_URI is not defined in environment variables')
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // SSL/TLS options for better compatibility
  tls: true,
  tlsAllowInvalidCertificates: false,
  // Connection pool options
  maxPoolSize: 10,
  minPoolSize: 1,
  // Connection timeout
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  // Retry options
  retryWrites: true,
  retryReads: true,
})

let db = null
let isConnecting = false

export async function connectToDatabase() {
  try {
    // If already connecting, wait a bit and retry
    if (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      return connectToDatabase()
    }

    // Check if already connected by trying a ping
    if (db) {
      try {
        await client.db("admin").command({ ping: 1 })
        return { client, db }
      } catch (pingError) {
        // Connection lost, reset and reconnect
        db = null
      }
    }

    isConnecting = true

    // Connect the client to the server
    await client.connect()
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 })
    console.log("✅ Successfully connected to MongoDB!")
    
    // Get the database
    db = client.db("architect_portfolio")
    
    isConnecting = false
    return { client, db }
  } catch (error) {
    isConnecting = false
    console.error("❌ MongoDB connection error:", error)
    
    // Provide helpful error messages
    if (error.message && (error.message.includes('SSL') || error.message.includes('TLS'))) {
      console.error("\n💡 SSL/TLS Error - This might be due to:")
      console.error("   1. Network/firewall blocking the connection")
      console.error("   2. MongoDB Atlas IP whitelist restrictions")
      console.error("   3. Node.js version compatibility issues")
      console.error("   4. Try checking your MongoDB Atlas network access settings")
      console.error("\n📖 Run 'npm run test-connection' to diagnose the issue")
      console.error("📖 See TROUBLESHOOTING.md for detailed help\n")
    }
    
    throw error
  }
}

export async function closeDatabaseConnection() {
  try {
    await client.close()
    console.log("MongoDB connection closed")
  } catch (error) {
    console.error("Error closing MongoDB connection:", error)
  }
}

