import express from 'express'
import {
  getPublishedNews,
  getNewsBySlug
} from '../controllers/newsController.js'

const router = express.Router()

// GET all published news (public)
router.get('/', getPublishedNews)

// GET news by slug (public)
router.get('/:slug', getNewsBySlug)

export default router
