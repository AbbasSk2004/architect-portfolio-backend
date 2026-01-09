import express from 'express'
import {
  getAdminApplications,
  getAdminApplicationById,
  updateAdminApplicationStatus,
  bulkUpdateAdminApplicationStatus,
  exportAdminApplications,
  downloadAdminApplicationFile
} from '../controllers/adminCareerController.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

// All routes require admin authentication
router.use(authenticateAdmin)

// GET all applications (with filtering, pagination, search)
router.get('/', getAdminApplications)

// GET export applications to CSV
router.get('/export', exportAdminApplications)

// GET a single application by ID
router.get('/:id', getAdminApplicationById)

// GET download CV or Portfolio
router.get('/:id/download', downloadAdminApplicationFile)

// PATCH update application status
router.patch('/:id/status', updateAdminApplicationStatus)

// PATCH bulk update application status
router.patch('/bulk-status', bulkUpdateAdminApplicationStatus)

export default router
