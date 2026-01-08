import express from 'express'
import {
  getAllTestimonialsAdmin,
  approveTestimonial,
  rejectTestimonial
} from '../controllers/adminTestimonialsController.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

// All routes require admin authentication
router.use(authenticateAdmin)

// GET all testimonials (with filtering)
router.get('/', getAllTestimonialsAdmin)

// PATCH approve testimonial
router.patch('/:id/approve', approveTestimonial)

// PATCH reject testimonial
router.patch('/:id/reject', rejectTestimonial)

export default router
