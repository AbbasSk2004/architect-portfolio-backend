import express from 'express'
import {
  getAdminBlogs,
  getAdminBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  publishBlog,
  unpublishBlog
} from '../controllers/blogController.js'
import { authenticateAdmin } from '../middleware/auth.js'
import { uploadBlogCoverMulter, uploadBlogCoverToCloudinary, handleUploadError } from '../middleware/upload.js'

const router = express.Router()

// All routes require admin authentication
router.use(authenticateAdmin)

// GET all blogs (admin)
router.get('/', getAdminBlogs)

// GET single blog by ID (admin)
router.get('/:id', getAdminBlogById)

// POST create blog (admin) - supports file uploads
router.post(
  '/',
  uploadBlogCoverMulter,
  handleUploadError,
  uploadBlogCoverToCloudinary,
  createBlog
)

// PUT update blog (admin) - supports file uploads
router.put(
  '/:id',
  uploadBlogCoverMulter,
  handleUploadError,
  uploadBlogCoverToCloudinary,
  updateBlog
)

// DELETE blog (admin)
router.delete('/:id', deleteBlog)

// PATCH publish blog (admin)
router.patch('/:id/publish', publishBlog)

// PATCH unpublish blog (admin)
router.patch('/:id/unpublish', unpublishBlog)

export default router
