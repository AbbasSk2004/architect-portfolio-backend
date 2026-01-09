import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'
import Stripe from 'stripe'
import dotenv from 'dotenv'

dotenv.config()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
})

/**
 * Create a new inquiry (Step 1: Identity)
 */
export const createInquiryIdentity = async (req, res, next) => {
  try {
    const { clientType, firstName, lastName, email, phone } = req.body
    
    const { db } = await connectToDatabase()
    
    const newInquiry = {
      clientType: clientType || 'private',
      firstName: firstName?.trim() || '',
      lastName: lastName?.trim() || '',
      email: email?.trim().toLowerCase() || '',
      phone: phone?.trim() || '',
      step: 1,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection('inquiries').insertOne(newInquiry)
    
    const createdInquiry = await db.collection('inquiries').findOne({
      _id: result.insertedId
    })
    
    res.status(201).json({
      success: true,
      message: 'Identity information saved',
      data: createdInquiry
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update inquiry with project context (Step 2)
 */
export const updateInquiryContext = async (req, res, next) => {
  try {
    const { inquiryId } = req.params
    const { address, selectedServices, budget, timeline, surface, description } = req.body
    
    if (!ObjectId.isValid(inquiryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inquiry ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    
    // Get uploaded files from Cloudinary (set by uploadToCloudinary middleware)
    const documentUrls = req.uploadedFiles?.documents || []
    
    const updateData = {
      address: address?.trim() || '',
      selectedServices: Array.isArray(selectedServices) ? selectedServices : [],
      budget: budget || '',
      timeline: timeline || 'asap',
      surface: surface || '',
      description: description?.trim() || '',
      documentUrls: documentUrls,
      step: 2,
      updatedAt: new Date()
    }
    
    const result = await db.collection('inquiries').updateOne(
      { _id: new ObjectId(inquiryId) },
      { $set: updateData }
    )
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      })
    }
    
    const updatedInquiry = await db.collection('inquiries').findOne({
      _id: new ObjectId(inquiryId)
    })
    
    res.status(200).json({
      success: true,
      message: 'Project context saved',
      data: updatedInquiry
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update inquiry with path selection (Step 3)
 */
export const updateInquiryPath = async (req, res, next) => {
  try {
    const { inquiryId } = req.params
    const { selectedPath } = req.body
    
    if (!ObjectId.isValid(inquiryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inquiry ID format'
      })
    }
    
    if (!selectedPath || !['general', 'consult'].includes(selectedPath)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid path. Must be "general" or "consult"'
      })
    }
    
    const { db } = await connectToDatabase()
    
    const updateData = {
      selectedPath,
      step: 3,
      updatedAt: new Date()
    }
    
    const result = await db.collection('inquiries').updateOne(
      { _id: new ObjectId(inquiryId) },
      { $set: updateData }
    )
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      })
    }
    
    const updatedInquiry = await db.collection('inquiries').findOne({
      _id: new ObjectId(inquiryId)
    })
    
    res.status(200).json({
      success: true,
      message: 'Path selected',
      data: updatedInquiry
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Submit general inquiry (Step 4 - General Path)
 */
export const submitGeneralInquiry = async (req, res, next) => {
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
    
    if (inquiry.selectedPath !== 'general') {
      return res.status(400).json({
        success: false,
        message: 'This inquiry is not a general inquiry'
      })
    }
    
    const updateData = {
      step: 4,
      status: 'submitted',
      submittedAt: new Date(),
      updatedAt: new Date()
    }
    
    await db.collection('inquiries').updateOne(
      { _id: new ObjectId(inquiryId) },
      { $set: updateData }
    )
    
    const updatedInquiry = await db.collection('inquiries').findOne({
      _id: new ObjectId(inquiryId)
    })
    
    res.status(200).json({
      success: true,
      message: 'General inquiry submitted successfully',
      data: updatedInquiry
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update consultation details (Step 4 - Consultation Path)
 */
export const updateConsultationDetails = async (req, res, next) => {
  try {
    const { inquiryId } = req.params
    const { duration, roadmapReport, format, selectedDate, selectedTime } = req.body
    
    if (!ObjectId.isValid(inquiryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inquiry ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    
    const updateData = {
      consultationDetails: {
        duration: duration || '60',
        roadmapReport: roadmapReport || false,
        format: format || 'online',
        selectedDate: selectedDate || null,
        selectedTime: selectedTime || null
      },
      step: 4,
      updatedAt: new Date()
    }
    
    const result = await db.collection('inquiries').updateOne(
      { _id: new ObjectId(inquiryId) },
      { $set: updateData }
    )
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      })
    }
    
    const updatedInquiry = await db.collection('inquiries').findOne({
      _id: new ObjectId(inquiryId)
    })
    
    res.status(200).json({
      success: true,
      message: 'Consultation details saved',
      data: updatedInquiry
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get inquiry by ID
 */
export const getInquiryById = async (req, res, next) => {
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
    
    res.status(200).json({
      success: true,
      data: inquiry
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get all inquiries (admin)
 */
export const getAllInquiries = async (req, res, next) => {
  try {
    const { db } = await connectToDatabase()
    const inquiries = await db.collection('inquiries')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()
    
    res.status(200).json({
      success: true,
      data: inquiries
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Submit billing information for business clients (post-payment)
 */
export const submitBillingInfo = async (req, res, next) => {
  try {
    const { inquiryId } = req.params
    const { companyName, address, vatNumber } = req.body
    
    if (!ObjectId.isValid(inquiryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inquiry ID format'
      })
    }
    
    // Validate required fields
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      })
    }
    
    if (!address || !address.line1 || !address.city || !address.postalCode) {
      return res.status(400).json({
        success: false,
        message: 'Complete billing address is required (line1, city, postalCode)'
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
    
    // Get the Stripe customer ID
    let customerId = inquiry.stripeCustomerId
    
    // If we only have session ID, retrieve customer from session
    if (!customerId && inquiry.stripeSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(inquiry.stripeSessionId)
        customerId = session.customer
      } catch (sessionError) {
        console.error('Error retrieving session:', sessionError)
      }
    }
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Stripe customer not found. Please contact support.'
      })
    }
    
    // Update Stripe customer with company name + address
    await stripe.customers.update(customerId, {
      name: companyName.trim(),
      address: {
        line1: address.line1.trim(),
        line2: address.line2?.trim() || undefined,
        city: address.city.trim(),
        postal_code: address.postalCode.trim(),
        country: address.country || 'FR'
      }
    })
    
    // Add tax ID if provided
    if (vatNumber && vatNumber.trim()) {
      try {
        await stripe.customers.createTaxId(customerId, {
          type: 'eu_vat',
          value: vatNumber.trim()
        })
      } catch (taxIdError) {
        // Log error but don't fail - VAT might be invalid format
        console.error('Error creating tax ID:', taxIdError)
        // Continue anyway - we'll update the inquiry
      }
    }
    
    // Finalize invoice if it exists and is in draft status
    const invoiceId = inquiry.stripeInvoiceId
    if (invoiceId) {
      try {
        // Retrieve invoice to check status
        const invoice = await stripe.invoices.retrieve(invoiceId)
        
        // If invoice is draft, finalize it
        if (invoice.status === 'draft') {
          await stripe.invoices.finalizeInvoice(invoiceId)
          console.log('✅ Invoice finalized:', invoiceId)
        } else if (invoice.status === 'open' || invoice.status === 'paid') {
          console.log('ℹ️  Invoice already finalized:', {
            invoiceId: invoiceId,
            status: invoice.status
          })
        }
      } catch (invoiceError) {
        console.error('Error handling invoice:', invoiceError)
        // Don't fail the request if invoice update fails
      }
    }
    
    // Update inquiry with billing collected and invoice finalized
    await db.collection('inquiries').updateOne(
      { _id: new ObjectId(inquiryId) },
      {
        $set: {
          status: 'paid',
          invoiceStatus: 'finalized',
          billingCollectedAt: new Date(),
          updatedAt: new Date()
        }
      }
    )
    
    res.status(200).json({
      success: true,
      message: 'Billing information submitted successfully'
    })
  } catch (error) {
    console.error('Error submitting billing info:', error)
    next(error)
  }
}

