import express from 'express'
import {
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial
} from '../controllers/testimonialsController.js'
import {
  validateCreateTestimonial,
  validateUpdateTestimonial
} from '../middleware/validation.js'

const router = express.Router()

// GET all testimonials
router.get('/', getAllTestimonials)

// GET a single testimonial by ID
router.get('/:id', getTestimonialById)

// POST create a new testimonial
router.post('/', validateCreateTestimonial, createTestimonial)

// PUT update a testimonial
router.put('/:id', validateUpdateTestimonial, updateTestimonial)

// DELETE a testimonial
router.delete('/:id', deleteTestimonial)

export default router

