import express from 'express'
import {
  getPublishedProjects,
  getProjectBySlug
} from '../controllers/projectController.js'

const router = express.Router()

// GET all published projects (public)
router.get('/', getPublishedProjects)

// GET single project by slug (public)
router.get('/:slug', getProjectBySlug)

export default router
