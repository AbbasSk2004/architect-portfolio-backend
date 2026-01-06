import { verifyAccessToken, extractTokenFromHeader } from '../utils/jwt.js'
import { findAdminById } from '../models/admin.js'

/**
 * Authentication middleware
 * Verifies JWT token and attaches admin info to request
 */
export async function authenticateAdmin(req, res, next) {
  try {
    // Get token from Authorization header or cookies
    let token = null
    
    // Try Authorization header first
    const authHeader = req.headers.authorization
    if (authHeader) {
      token = extractTokenFromHeader(authHeader)
    }
    
    // Fallback to cookie
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      })
    }
    
    // Verify token
    const decoded = verifyAccessToken(token)
    
    // Verify admin still exists
    const admin = await findAdminById(decoded.id)
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Admin account not found'
      })
    }
    
    // Attach admin info to request
    req.admin = {
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role
    }
    
    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid or expired token'
    })
  }
}

