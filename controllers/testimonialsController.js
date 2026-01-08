import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'

/**
 * Get all testimonials (PUBLIC - only returns approved testimonials)
 * Handles migration: testimonials without status field are treated as approved
 */
export const getAllTestimonials = async (req, res, next) => {
  try {
    const { db } = await connectToDatabase()
    // Only return approved testimonials for public display
    // Also include testimonials without status field (for backward compatibility)
    const testimonials = await db.collection('testimonials')
      .find({
        $or: [
          { status: 'approved' },
          { status: { $exists: false } } // Legacy testimonials without status
        ]
      })
      .sort({ createdAt: -1 }) // Sort by newest first
      .toArray()
    
    res.status(200).json({
      success: true,
      data: testimonials
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get a single testimonial by ID
 */
export const getTestimonialById = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid testimonial ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    const testimonial = await db.collection('testimonials').findOne({
      _id: new ObjectId(id)
    })
    
    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      })
    }
    
    res.status(200).json({
      success: true,
      data: testimonial
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create a new testimonial
 */
export const createTestimonial = async (req, res, next) => {
  try {
    const { fullName, phoneNumber, email, projectType, review } = req.body
    
    const { db } = await connectToDatabase()
    
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPhone = phoneNumber?.trim() || null
    
    // Check for duplicate email
    const existingEmail = await db.collection('testimonials').findOne({
      email: normalizedEmail
    })
    
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'A testimonial with this email already exists'
      })
    }
    
    // Check for duplicate phone number if provided
    if (normalizedPhone) {
      const existingPhone = await db.collection('testimonials').findOne({
        phoneNumber: normalizedPhone
      })
      
      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message: 'A testimonial with this phone number already exists'
        })
      }
    }
    
    const newTestimonial = {
      fullName: fullName.trim(),
      phoneNumber: normalizedPhone,
      email: normalizedEmail,
      projectType: projectType?.trim() || null,
      review: review.trim(),
      status: 'pending', // Default status - requires admin approval
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection('testimonials').insertOne(newTestimonial)
    
    const createdTestimonial = await db.collection('testimonials').findOne({
      _id: result.insertedId
    })
    
    res.status(201).json({
      success: true,
      message: 'Testimonial created successfully',
      data: createdTestimonial
    })
  } catch (error) {
    // Handle MongoDB duplicate key error (E11000)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return res.status(409).json({
        success: false,
        message: `A testimonial with this ${field} already exists`
      })
    }
    next(error)
  }
}

/**
 * Update a testimonial
 */
export const updateTestimonial = async (req, res, next) => {
  try {
    const { id } = req.params
    const { fullName, phoneNumber, email, projectType, review } = req.body
    
    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid testimonial ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    
    // Check if testimonial exists
    const existingTestimonial = await db.collection('testimonials').findOne({
      _id: new ObjectId(id)
    })
    
    if (!existingTestimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      })
    }
    
    // Check for duplicate email if email is being updated
    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase()
      const duplicateEmail = await db.collection('testimonials').findOne({
        email: normalizedEmail,
        _id: { $ne: new ObjectId(id) } // Exclude current testimonial
      })
      
      if (duplicateEmail) {
        return res.status(409).json({
          success: false,
          message: 'A testimonial with this email already exists'
        })
      }
    }
    
    // Check for duplicate phone number if phone is being updated
    if (phoneNumber !== undefined) {
      const normalizedPhone = phoneNumber?.trim() || null
      if (normalizedPhone) {
        const duplicatePhone = await db.collection('testimonials').findOne({
          phoneNumber: normalizedPhone,
          _id: { $ne: new ObjectId(id) } // Exclude current testimonial
        })
        
        if (duplicatePhone) {
          return res.status(409).json({
            success: false,
            message: 'A testimonial with this phone number already exists'
          })
        }
      }
    }
    
    // Build update object with only provided fields
    const updateData = {
      updatedAt: new Date()
    }
    
    if (fullName !== undefined) updateData.fullName = fullName.trim()
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber?.trim() || null
    if (email !== undefined) updateData.email = email.trim().toLowerCase()
    if (projectType !== undefined) updateData.projectType = projectType?.trim() || null
    if (review !== undefined) updateData.review = review.trim()
    
    const result = await db.collection('testimonials').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      })
    }
    
    const updatedTestimonial = await db.collection('testimonials').findOne({
      _id: new ObjectId(id)
    })
    
    res.status(200).json({
      success: true,
      message: 'Testimonial updated successfully',
      data: updatedTestimonial
    })
  } catch (error) {
    // Handle MongoDB duplicate key error (E11000)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return res.status(409).json({
        success: false,
        message: `A testimonial with this ${field} already exists`
      })
    }
    next(error)
  }
}

/**
 * Delete a testimonial
 */
export const deleteTestimonial = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid testimonial ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    const result = await db.collection('testimonials').deleteOne({
      _id: new ObjectId(id)
    })
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      })
    }
    
    res.status(200).json({
      success: true,
      message: 'Testimonial deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

