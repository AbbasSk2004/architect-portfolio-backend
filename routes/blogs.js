import express from 'express'
import {
  getPublishedBlogs,
  getBlogBySlug
} from '../controllers/blogController.js'

const router = express.Router()

// GET all published blogs (public)
router.get('/', getPublishedBlogs)

// GET blog by slug (public)
router.get('/:slug', getBlogBySlug)

export default router
