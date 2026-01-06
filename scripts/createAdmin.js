/**
 * Script to create the first admin user
 * Usage: node scripts/createAdmin.js <email> <password>
 */

import { createAdmin } from '../models/admin.js'
import { connectToDatabase } from '../config/database.js'
import dotenv from 'dotenv'

dotenv.config()

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.error('Usage: node scripts/createAdmin.js <email> <password>')
    process.exit(1)
  }
  
  const [email, password] = args
  
  try {
    // Connect to database
    await connectToDatabase()
    console.log('✅ Connected to database')
    
    // Create admin
    const admin = await createAdmin({ email, password, role: 'admin' })
    console.log('✅ Admin created successfully!')
    console.log('Admin ID:', admin._id)
    console.log('Email:', admin.email)
    console.log('Role:', admin.role)
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating admin:', error.message)
    process.exit(1)
  }
}

main()

