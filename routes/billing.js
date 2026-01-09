import express from 'express'
import { submitBusinessBilling } from '../controllers/billingController.js'

const router = express.Router()

// POST submit business billing information (post-payment)
router.post('/business', submitBusinessBilling)

export default router
