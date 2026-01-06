import express from 'express'
import { login, logout, refreshToken, getCurrentAdmin } from '../controllers/authController.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

// Public routes
router.post('/login', login)
router.post('/logout', logout)
router.post('/refresh', refreshToken)

// Protected routes
router.get('/me', authenticateAdmin, getCurrentAdmin)

export default router

