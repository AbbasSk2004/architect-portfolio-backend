import express from 'express'
import {
  getAdminProjects,
  getAdminProjectById,
  createProject,
  updateProject,
  deleteProject,
  publishProject,
  unpublishProject
} from '../controllers/projectController.js'
import { authenticateAdmin } from '../middleware/auth.js'

const router = express.Router()

// All routes require admin authentication
router.use(authenticateAdmin)

// GET all projects (admin)
router.get('/', getAdminProjects)

// GET single project by ID (admin)
router.get('/:id', getAdminProjectById)

// POST create project (admin)
router.post('/', createProject)

// PUT update project (admin)
router.put('/:id', updateProject)

// DELETE project (admin)
router.delete('/:id', deleteProject)

// PATCH publish project (admin)
router.patch('/:id/publish', publishProject)

// PATCH unpublish project (admin)
router.patch('/:id/unpublish', unpublishProject)

export default router
