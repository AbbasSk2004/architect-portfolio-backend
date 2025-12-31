import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'

/**
 * Get all career applications
 */
export const getAllApplications = async (req, res, next) => {
  try {
    const { db } = await connectToDatabase()
    const applications = await db.collection('career_applications')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()
    
    res.status(200).json({
      success: true,
      data: applications
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get a single application by ID
 */
export const getApplicationById = async (req, res, next) => {
  try {
    const { id } = req.params
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    const application = await db.collection('career_applications').findOne({
      _id: new ObjectId(id)
    })
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      })
    }
    
    res.status(200).json({
      success: true,
      data: application
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create a new career application
 */
export const createApplication = async (req, res, next) => {
  try {
    const { fullName, email, motivationLetter, jobTitle } = req.body
    
    // Get uploaded files from Cloudinary (set by uploadToCloudinary middleware)
    const cvUrl = req.uploadedFiles?.cv || null
    const portfolioUrl = req.uploadedFiles?.portfolio || null
    
    if (!cvUrl) {
      return res.status(400).json({
        success: false,
        message: 'CV file is required'
      })
    }
    
    const { db } = await connectToDatabase()
    
    const newApplication = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      motivationLetter: motivationLetter.trim(),
      jobTitle: jobTitle.trim(),
      cvUrl,
      portfolioUrl: portfolioUrl || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection('career_applications').insertOne(newApplication)
    
    const createdApplication = await db.collection('career_applications').findOne({
      _id: result.insertedId
    })
    
    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: createdApplication
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update application status
 */
export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format'
      })
    }
    
    const validStatuses = ['pending', 'reviewed', 'accepted', 'rejected']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      })
    }
    
    const { db } = await connectToDatabase()
    
    const result = await db.collection('career_applications').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status,
          updatedAt: new Date()
        } 
      }
    )
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      })
    }
    
    const updatedApplication = await db.collection('career_applications').findOne({
      _id: new ObjectId(id)
    })
    
    res.status(200).json({
      success: true,
      message: 'Application status updated successfully',
      data: updatedApplication
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete an application
 */
export const deleteApplication = async (req, res, next) => {
  try {
    const { id } = req.params
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    const result = await db.collection('career_applications').deleteOne({
      _id: new ObjectId(id)
    })
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      })
    }
    
    res.status(200).json({
      success: true,
      message: 'Application deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

