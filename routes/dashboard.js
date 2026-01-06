import express from 'express'
import { getDashboardStats } from '../controllers/dashboardController.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

// All dashboard routes require authentication
router.get('/stats', authenticateAdmin, getDashboardStats)

export default router

