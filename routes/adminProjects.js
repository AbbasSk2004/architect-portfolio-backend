import express from 'express'
import {
  getAdminProjects,
  getAdminProjectById,
  createProject,
  updateProject,
  deleteProject,
  publishProject,
  unpublishProject,
  deleteProjectImage
} from '../controllers/projectController.js'
import { authenticateAdmin } from '../middleware/auth.js'
import { uploadProjectImagesMulter, uploadProjectImagesToCloudinary, handleUploadError } from '../middleware/upload.js'

const router = express.Router()

// All routes require admin authentication
router.use(authenticateAdmin)

// GET all projects (admin)
router.get('/', getAdminProjects)

// GET single project by ID (admin)
router.get('/:id', getAdminProjectById)

// POST create project (admin) - supports file uploads
router.post(
  '/',
  uploadProjectImagesMulter,
  handleUploadError,
  uploadProjectImagesToCloudinary,
  createProject
)

// PUT update project (admin) - supports file uploads
router.put(
  '/:id',
  uploadProjectImagesMulter,
  handleUploadError,
  uploadProjectImagesToCloudinary,
  updateProject
)

// DELETE project image (admin) - deletes from Cloudinary
router.delete('/:id/image', deleteProjectImage)

// DELETE project (admin)
router.delete('/:id', deleteProject)

// PATCH publish project (admin)
router.patch('/:id/publish', publishProject)

// PATCH unpublish project (admin)
router.patch('/:id/unpublish', unpublishProject)

export default router
