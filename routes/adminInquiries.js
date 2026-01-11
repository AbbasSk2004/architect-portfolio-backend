import express from 'express'
import {
  getAdminInquiries,
  getAdminInquiryById,
  updateAdminInquiryStatus,
  bulkUpdateAdminInquiryStatus,
  deleteAdminInquiry,
  exportAdminInquiries
} from '../controllers/adminInquiryController.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

// All routes require admin authentication
router.use(authenticateAdmin)

// GET all inquiries (admin) - with filtering, pagination, search
router.get('/', getAdminInquiries)

// GET single inquiry by ID (admin)
router.get('/:id', getAdminInquiryById)

// PATCH update inquiry status (admin)
router.patch('/:id/status', updateAdminInquiryStatus)

// PATCH bulk update inquiry status (admin)
router.patch('/bulk-status', bulkUpdateAdminInquiryStatus)

// DELETE inquiry (admin)
router.delete('/:id', deleteAdminInquiry)

// GET export inquiries to CSV (admin)
router.get('/export', exportAdminInquiries)

export default router
