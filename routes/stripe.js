import express from 'express'
import {
  createCheckoutSession,
  getCheckoutSession,
  verifyPaymentStatus
} from '../controllers/stripeController.js'

const router = express.Router()

// Create checkout session
router.post('/create-checkout-session', createCheckoutSession)

// Get checkout session status
router.get('/session/:sessionId', getCheckoutSession)

// Manually verify payment status for an inquiry (useful for debugging)
router.get('/verify-payment/:inquiryId', verifyPaymentStatus)

export default router

