import Stripe from 'stripe'
import dotenv from 'dotenv'
import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'

dotenv.config()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
})

/**
 * Create Stripe checkout session for consultation
 */
export const createCheckoutSession = async (req, res, next) => {
  try {
    const { inquiryId, duration, roadmapReport } = req.body
    
    if (!ObjectId.isValid(inquiryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inquiry ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    const inquiry = await db.collection('inquiries').findOne({
      _id: new ObjectId(inquiryId)
    })
    
    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      })
    }
    
    // Calculate price
    const durationPrices = {
      '30': 6499, // €64.99 in cents
      '60': 9999, // €99.99 in cents
      '90': 15999 // €159.99 in cents
    }
    
    const basePrice = durationPrices[duration] || durationPrices['60']
    const roadmapPrice = roadmapReport ? 5000 : 0 // €50.00 in cents
    const totalPrice = basePrice + roadmapPrice
    
    // Create line items
    const lineItems = [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Expert Consultation - ${duration} minutes`,
            description: `Architecture consultation session (${duration} minutes)`,
          },
          unit_amount: basePrice,
        },
        quantity: 1,
      }
    ]
    
    if (roadmapReport) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'The Roadmap Report',
            description: 'Written summary & action plan',
          },
          unit_amount: roadmapPrice,
        },
        quantity: 1,
      })
    }
    
    // Get frontend URL for redirects
    // In production, use FRONTEND_URLS from env, otherwise default to localhost for development
    const getFrontendUrl = () => {
      if (process.env.FRONTEND_URLS) {
        // Get first URL from comma-separated list and remove trailing slash
        const url = process.env.FRONTEND_URLS.split(',')[0].trim()
        return url.endsWith('/') ? url.slice(0, -1) : url
      }
      // For local development, check if we're in production mode
      if (process.env.NODE_ENV === 'production') {
        return 'https://architecture-portfolio-mu.vercel.app'
      }
      return 'http://localhost:3000'
    }
    
    const frontendUrl = getFrontendUrl()
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${frontendUrl}/inquiry/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/inquiry/cancel`,
      metadata: {
        inquiryId: inquiryId,
        duration: duration,
        roadmapReport: roadmapReport ? 'true' : 'false',
      },
      customer_email: inquiry.email,
    })
    
    // Update inquiry with session ID
    await db.collection('inquiries').updateOne(
      { _id: new ObjectId(inquiryId) },
      { 
        $set: { 
          stripeSessionId: session.id,
          paymentStatus: 'pending',
          updatedAt: new Date()
        } 
      }
    )
    
    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    })
  } catch (error) {
    console.error('Stripe error:', error)
    next(error)
  }
}

/**
 * Get checkout session status
 */
export const getCheckoutSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params
    
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    
    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        status: session.status,
        customerEmail: session.customer_email,
        amountTotal: session.amount_total,
        currency: session.currency,
      }
    })
  } catch (error) {
    console.error('Stripe error:', error)
    next(error)
  }
}

/**
 * Stripe webhook handler
 */
export const handleWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  
  console.log('🔔 Webhook received')
  console.log('Webhook secret configured:', !!webhookSecret)
  
  let event
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    console.log('✅ Webhook signature verified. Event type:', event.type)
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }
  
  try {
    const { db } = await connectToDatabase()
    
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object
        const inquiryId = session.metadata?.inquiryId
        const paymentStatus = session.payment_status
        
        console.log('📦 Checkout session completed:', {
          sessionId: session.id,
          inquiryId: inquiryId,
          paymentStatus: paymentStatus,
          amountTotal: session.amount_total,
          currency: session.currency
        })
        
        // Only update if payment is actually paid
        if (paymentStatus === 'paid' && inquiryId && ObjectId.isValid(inquiryId)) {
          const result = await db.collection('inquiries').updateOne(
            { _id: new ObjectId(inquiryId) },
            { 
              $set: { 
                paymentStatus: 'paid',
                status: 'paid',
                paidAt: new Date(),
                updatedAt: new Date()
              } 
            }
          )
          
          console.log('✅ Inquiry updated:', {
            inquiryId: inquiryId,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
          })
          
          if (result.matchedCount === 0) {
            console.warn('⚠️  Inquiry not found with ID:', inquiryId)
          }
        } else {
          console.warn('⚠️  Payment not completed or invalid inquiry ID:', {
            paymentStatus: paymentStatus,
            inquiryId: inquiryId,
            isValid: inquiryId ? ObjectId.isValid(inquiryId) : false
          })
        }
        break
      
      case 'payment_intent.succeeded':
        console.log('💳 Payment intent succeeded:', event.data.object.id)
        // Additional payment confirmation if needed
        break
      
      case 'checkout.session.async_payment_succeeded':
        // Handle async payment methods (like bank transfers)
        const asyncSession = event.data.object
        const asyncInquiryId = asyncSession.metadata?.inquiryId
        
        if (asyncInquiryId && ObjectId.isValid(asyncInquiryId)) {
          await db.collection('inquiries').updateOne(
            { _id: new ObjectId(asyncInquiryId) },
            { 
              $set: { 
                paymentStatus: 'paid',
                status: 'paid',
                paidAt: new Date(),
                updatedAt: new Date()
              } 
            }
          )
          console.log('✅ Async payment completed for inquiry:', asyncInquiryId)
        }
        break
      
      default:
        console.log(`ℹ️  Unhandled event type: ${event.type}`)
    }
    
    res.json({ received: true })
  } catch (error) {
    console.error('❌ Webhook handler error:', error)
    next(error)
  }
}

/**
 * Manually verify and update payment status for an inquiry
 * Useful for debugging or if webhook failed
 */
export const verifyPaymentStatus = async (req, res, next) => {
  try {
    const { inquiryId } = req.params
    
    if (!ObjectId.isValid(inquiryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inquiry ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    const inquiry = await db.collection('inquiries').findOne({
      _id: new ObjectId(inquiryId)
    })
    
    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      })
    }
    
    if (!inquiry.stripeSessionId) {
      return res.status(400).json({
        success: false,
        message: 'No Stripe session ID found for this inquiry'
      })
    }
    
    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(inquiry.stripeSessionId)
    
    console.log('🔍 Verifying payment status:', {
      inquiryId: inquiryId,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status
    })
    
    // Update if payment is completed
    if (session.payment_status === 'paid' && inquiry.paymentStatus !== 'paid') {
      await db.collection('inquiries').updateOne(
        { _id: new ObjectId(inquiryId) },
        { 
          $set: { 
            paymentStatus: 'paid',
            status: 'paid',
            paidAt: new Date(),
            updatedAt: new Date()
          } 
        }
      )
      
      return res.status(200).json({
        success: true,
        message: 'Payment status updated to paid',
        data: {
          inquiryId: inquiryId,
          paymentStatus: 'paid',
          sessionId: session.id
        }
      })
    }
    
    return res.status(200).json({
      success: true,
      message: 'Payment status verified',
      data: {
        inquiryId: inquiryId,
        currentPaymentStatus: inquiry.paymentStatus,
        stripePaymentStatus: session.payment_status,
        sessionStatus: session.status,
        needsUpdate: session.payment_status === 'paid' && inquiry.paymentStatus !== 'paid'
      }
    })
  } catch (error) {
    console.error('Error verifying payment status:', error)
    next(error)
  }
}

