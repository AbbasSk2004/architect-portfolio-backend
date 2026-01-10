import express from 'express'
import {
  getAdminNews,
  getAdminNewsById,
  createNews,
  updateNews,
  deleteNews,
  publishNews,
  unpublishNews
} from '../controllers/newsController.js'
import { authenticateAdmin } from '../middleware/auth.js'
import { uploadNewsCoverMulter, uploadNewsCoverToCloudinary, handleUploadError } from '../middleware/upload.js'

const router = express.Router()

// All routes require admin authentication
router.use(authenticateAdmin)

// GET all news (admin)
router.get('/', getAdminNews)

// GET single news by ID (admin)
router.get('/:id', getAdminNewsById)

// POST create news (admin) - supports file uploads
router.post(
  '/',
  uploadNewsCoverMulter,
  handleUploadError,
  uploadNewsCoverToCloudinary,
  createNews
)

// PUT update news (admin) - supports file uploads
router.put(
  '/:id',
  uploadNewsCoverMulter,
  handleUploadError,
  uploadNewsCoverToCloudinary,
  updateNews
)

// DELETE news (admin)
router.delete('/:id', deleteNews)

// PATCH publish news (admin)
router.patch('/:id/publish', publishNews)

// PATCH unpublish news (admin)
router.patch('/:id/unpublish', unpublishNews)

export default router
