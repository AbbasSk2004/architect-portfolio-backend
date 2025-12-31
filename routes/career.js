import express from 'express'
import {
  getAllApplications,
  getApplicationById,
  createApplication,
  updateApplicationStatus,
  deleteApplication
} from '../controllers/careerController.js'
import { validateCreateApplication } from '../middleware/validation.js'
import { uploadMultiple, uploadToCloudinary, handleUploadError } from '../middleware/upload.js'

const router = express.Router()

// GET all applications
router.get('/', getAllApplications)

// GET a single application by ID
router.get('/:id', getApplicationById)

// POST create a new application (with file uploads)
router.post(
  '/',
  uploadMultiple,
  handleUploadError,
  uploadToCloudinary,
  validateCreateApplication,
  createApplication
)

// PUT update application status
router.put('/:id/status', updateApplicationStatus)

// DELETE an application
router.delete('/:id', deleteApplication)

export default router

