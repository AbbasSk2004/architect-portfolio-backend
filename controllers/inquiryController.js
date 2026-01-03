import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'

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
    const { duration, roadmapReport, format, selectedDate, selectedTime, billingInfo } = req.body
    
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
        selectedTime: selectedTime || null,
        billingInfo: billingInfo || null
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

