import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'
import bcrypt from 'bcryptjs'

/**
 * Admin Model
 * Handles admin authentication and database operations
 */

/**
 * Create a new admin user
 * @param {Object} adminData - Admin data (email, password, role)
 * @returns {Promise<Object>} Created admin document
 */
export async function createAdmin(adminData) {
  const { email, password, role = 'admin' } = adminData
  
  if (!email || !password) {
    throw new Error('Email and password are required')
  }
  
  const { db } = await connectToDatabase()
  
  // Check if admin already exists
  const existingAdmin = await db.collection('admins').findOne({ email: email.toLowerCase() })
  if (existingAdmin) {
    throw new Error('Admin with this email already exists')
  }
  
  // Hash password
  const saltRounds = 10
  const hashedPassword = await bcrypt.hash(password, saltRounds)
  
  const newAdmin = {
    email: email.toLowerCase(),
    password: hashedPassword,
    role: role,
    createdAt: new Date(),
    updatedAt: new Date()
  }
  
  const result = await db.collection('admins').insertOne(newAdmin)
  
  return {
    _id: result.insertedId,
    email: newAdmin.email,
    role: newAdmin.role,
    createdAt: newAdmin.createdAt
  }
}

/**
 * Find admin by email
 * @param {string} email - Admin email
 * @returns {Promise<Object|null>} Admin document or null
 */
export async function findAdminByEmail(email) {
  const { db } = await connectToDatabase()
  return await db.collection('admins').findOne({ email: email.toLowerCase() })
}

/**
 * Find admin by ID
 * @param {string} adminId - Admin ID
 * @returns {Promise<Object|null>} Admin document or null
 */
export async function findAdminById(adminId) {
  const { db } = await connectToDatabase()
  
  if (!ObjectId.isValid(adminId)) {
    return null
  }
  
  return await db.collection('admins').findOne({ _id: new ObjectId(adminId) })
}

/**
 * Verify admin password
 * @param {string} plainPassword - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword)
}

