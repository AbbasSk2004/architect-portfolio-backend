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
    
    // Validate email is present and properly formatted (REQUIRED for Stripe automatic emails)
    if (!inquiry.email || typeof inquiry.email !== 'string' || !inquiry.email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Inquiry email is required for payment processing and receipt delivery'
      })
    }
    
    // Normalize email (lowercase, trim) for Stripe
    const customerEmail = inquiry.email.trim().toLowerCase()
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format in inquiry. Please provide a valid email address.'
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
    
    // Get clientType from inquiry to configure billing address collection
    const clientType = inquiry.clientType || 'private'
    
    // Create checkout session configuration based on client type
    // For French invoicing compliance:
    // - Private: Collect personal billing address (no company)
    // - Business: Collect company billing address (with company name)
    const sessionConfig = {
      mode: 'payment',
      payment_method_types: ['card'],
      
      // CRITICAL: Force customer creation to enable automatic email sending
      customer_creation: 'always',
      customer_email: customerEmail, // Use normalized email
      
      // Billing address collection: 'required' ensures Stripe prompts for billing address
      // This is important for AVS (Address Verification System) checks and compliance
      billing_address_collection: 'required',
      
      // Enable tax ID collection so Checkout asks for VAT when supported
      tax_id_collection: {
        enabled: true,
        // Require when clientType is business in supported countries
        required: clientType === 'business' ? 'if_supported' : 'never'
      },
      
      line_items: lineItems,
      
      success_url: `${frontendUrl}/inquiry/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/inquiry/cancel`,
      
      metadata: {
        inquiryId: inquiryId,
        duration: duration,
        roadmapReport: roadmapReport ? 'true' : 'false',
        clientType: clientType, // Store client type in metadata
      },
    }
    
    const session = await stripe.checkout.sessions.create(sessionConfig)
    
    // Log customer creation for debugging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Stripe checkout session created:', {
        sessionId: session.id,
        customerEmail: customerEmail,
        customerId: session.customer || 'Will be created on payment',
        invoiceId: session.invoice || 'Will be created on payment',
        clientType: clientType,
        billingAddressCollection: 'required',
        taxIdCollection: 'enabled',
        mode: 'payment'
      })
    }
    
    // Store session id, customer id, and invoice id in DB
    await db.collection('inquiries').updateOne(
      { _id: new ObjectId(inquiryId) },
      { 
        $set: { 
          stripeSessionId: session.id,
          stripeCustomerId: session.customer || null, // might be null until completed
          stripeInvoiceId: session.invoice || null,
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
 * Get checkout session status and automatically update inquiry if payment is paid
 */
export const getCheckoutSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params
    
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const inquiryId = session.metadata?.inquiryId
    
    // If payment is paid, automatically update the inquiry in database
    // This acts as a backup if the webhook failed
    if (session.payment_status === 'paid' && inquiryId && ObjectId.isValid(inquiryId)) {
      try {
        const { db } = await connectToDatabase()
        const updateResult = await db.collection('inquiries').updateOne(
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
        
        console.log('✅ Auto-updated inquiry from session check:', {
          sessionId: sessionId,
          inquiryId: inquiryId,
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount
        })
      } catch (updateError) {
        console.error('⚠️  Error auto-updating inquiry:', updateError)
        // Don't fail the request if update fails, just log it
      }
    }
    
    res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        paymentStatus: session.payment_status,
        status: session.status,
        customerEmail: session.customer_email,
        amountTotal: session.amount_total,
        currency: session.currency,
        inquiryId: inquiryId,
        metadata: session.metadata || {},
        customer: session.customer,
        invoice: session.invoice,
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
      case 'checkout.session.completed': {
        // SINGLE SOURCE OF TRUTH for Checkout payments
        const session = event.data.object
        const inquiryId = session.metadata?.inquiryId
        const customerId = session.customer
        const invoiceId = session.invoice
        const clientType = session.metadata?.clientType || 'private'
        const paymentStatus = session.payment_status

        console.log('📦 Checkout session completed (single source of truth):', {
          sessionId: session.id,
          inquiryId: inquiryId,
          paymentStatus: paymentStatus,
          clientType: clientType,
          customerId: customerId,
          invoiceId: invoiceId,
          amountTotal: session.amount_total,
          currency: session.currency
        })

        // Only process if we have a valid inquiry ID
        if (!inquiryId || !ObjectId.isValid(inquiryId)) {
          console.warn('⚠️  Invalid or missing inquiry ID in session metadata')
          break
        }

        // Persist customer & invoice IDs and mark as paid
        // For business clients, invoice status is 'billing_pending' until billing info is collected
        // For private clients, invoice can be finalized immediately
        await db.collection('inquiries').updateOne(
          { _id: new ObjectId(inquiryId) },
          {
            $set: {
              paymentStatus: paymentStatus === 'paid' ? 'paid' : 'pending',
              status: paymentStatus === 'paid' ? 'paid' : 'pending',
              stripeCustomerId: customerId || null,
              stripeInvoiceId: invoiceId || null,
              // Invoice status: business clients need billing info before finalization
              invoiceStatus: paymentStatus === 'paid' && clientType === 'business'
                ? 'billing_pending'
                : paymentStatus === 'paid' ? 'finalized' : 'pending',
              paidAt: paymentStatus === 'paid' ? new Date() : undefined,
              updatedAt: new Date()
            }
          }
        )

        if (paymentStatus === 'paid') {
          console.log('✅ Payment completed - Inquiry updated:', {
            inquiryId: inquiryId,
            clientType: clientType,
            invoiceStatus: clientType === 'business' ? 'billing_pending' : 'finalized'
          })

          // For business clients, invoice will be finalized after billing info is collected
          // This happens via POST /api/billing/business endpoint
        }
        break
      }
      
      case 'payment_intent.succeeded':
        // Log only - do NOT use for business logic
        // checkout.session.completed is the source of truth for Checkout
        console.log('💳 Payment intent succeeded (logged only):', event.data.object.id)
        break
      
      case 'checkout.session.async_payment_succeeded':
        // Handle async payment methods (like bank transfers)
        // Use same logic as checkout.session.completed
        const asyncSession = event.data.object
        const asyncInquiryId = asyncSession.metadata?.inquiryId
        const asyncCustomerId = asyncSession.customer
        const asyncInvoiceId = asyncSession.invoice
        const asyncClientType = asyncSession.metadata?.clientType || 'private'
        
        if (asyncInquiryId && ObjectId.isValid(asyncInquiryId)) {
          await db.collection('inquiries').updateOne(
            { _id: new ObjectId(asyncInquiryId) },
            { 
              $set: { 
                paymentStatus: 'paid',
                status: 'paid',
                stripeCustomerId: asyncCustomerId || null,
                stripeInvoiceId: asyncInvoiceId || null,
                invoiceStatus: asyncClientType === 'business' ? 'billing_pending' : 'finalized',
                paidAt: new Date(),
                updatedAt: new Date()
              } 
            }
          )
          console.log('✅ Async payment completed for inquiry:', {
            inquiryId: asyncInquiryId,
            clientType: asyncClientType,
            invoiceStatus: asyncClientType === 'business' ? 'billing_pending' : 'finalized'
          })
        }
        break
      
      case 'invoice.finalized':
        // Log invoice finalization for tracking
        const finalizedInvoice = event.data.object
        console.log('📄 Invoice finalized:', {
          invoiceId: finalizedInvoice.id,
          customerId: finalizedInvoice.customer,
          status: finalizedInvoice.status
        })
        break
      
      case 'invoice.payment_succeeded':
        // Log invoice payment for tracking
        const paidInvoice = event.data.object
        console.log('💰 Invoice payment succeeded:', {
          invoiceId: paidInvoice.id,
          customerId: paidInvoice.customer,
          amount: paidInvoice.amount_paid
        })
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

