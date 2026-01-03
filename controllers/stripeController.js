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
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URLS?.split(',')[0] || 'http://localhost:3000'}/inquiry/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URLS?.split(',')[0] || 'http://localhost:3000'}/inquiry/cancel`,
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
  
  let event
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }
  
  try {
    const { db } = await connectToDatabase()
    
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object
        const inquiryId = session.metadata?.inquiryId
        
        if (inquiryId && ObjectId.isValid(inquiryId)) {
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
        }
        break
      
      case 'payment_intent.succeeded':
        // Handle successful payment
        break
      
      default:
        console.log(`Unhandled event type ${event.type}`)
    }
    
    res.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    next(error)
  }
}

