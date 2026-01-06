import { findAdminByEmail, verifyPassword } from '../models/admin.js'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js'

/**
 * Get cookie options based on environment
 * For cross-origin requests (production), use 'none' with secure
 * For same-origin requests (development), use 'strict'
 */
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  const options = {
    httpOnly: true,
    secure: isProduction, // Must be true for sameSite: 'none'
    sameSite: isProduction ? 'none' : 'strict', // 'none' for cross-origin, 'strict' for same-origin
    path: '/', // Explicit path for cookie clearing
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
  
  // Log cookie settings in production for debugging
  if (isProduction) {
    console.log('🍪 Cookie settings:', {
      secure: options.secure,
      sameSite: options.sameSite,
      httpOnly: options.httpOnly
    })
  }
  
  return options
}

/**
 * Admin login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }
    
    // Find admin
    const admin = await findAdminByEmail(email)
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, admin.password)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }
    
    // Generate tokens
    const tokenPayload = {
      id: admin._id.toString(),
      email: admin.email,
      role: admin.role
    }
    
    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = generateRefreshToken(tokenPayload)
    
    // Get cookie options
    const cookieOptions = getCookieOptions()
    
    // Set httpOnly cookies
    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    })
    
    res.cookie('refreshToken', refreshToken, cookieOptions)
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        admin: {
          id: admin._id.toString(),
          email: admin.email,
          role: admin.role
        },
        accessToken,
        refreshToken
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Admin logout
 */
export const logout = async (req, res, next) => {
  try {
    // Get cookie options to ensure proper clearing
    const cookieOptions = getCookieOptions()
    
    // Clear cookies with same options used to set them
    res.clearCookie('accessToken', cookieOptions)
    res.clearCookie('refreshToken', cookieOptions)
    
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Refresh access token
 */
export const refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      })
    }
    
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken)
    
    // Generate new access token
    const tokenPayload = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    }
    
    const newAccessToken = generateAccessToken(tokenPayload)
    
    // Get cookie options
    const cookieOptions = getCookieOptions()
    
    // Set new access token cookie
    res.cookie('accessToken', newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    })
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: {
        accessToken: newAccessToken
      }
    })
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid refresh token'
    })
  }
}

/**
 * Get current admin info
 */
export const getCurrentAdmin = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        admin: req.admin
      }
    })
  } catch (error) {
    next(error)
  }
}

