import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'

/**
 * Get all testimonials for admin (with status filtering)
 * Supports query params: ?status=pending|approved|rejected
 */
export const getAllTestimonialsAdmin = async (req, res, next) => {
  try {
    const { status, search } = req.query
    const { db } = await connectToDatabase()
    
    // Build query filter
    const filter = {}
    
    // Filter by status if provided
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status
    }
    
    // Search by name or email if provided
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' }
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex }
      ]
    }
    
    const testimonials = await db.collection('testimonials')
      .find(filter)
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
 * Approve a testimonial
 */
export const approveTestimonial = async (req, res, next) => {
  try {
    const { id } = req.params
    const adminId = req.admin?.id // From auth middleware
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid testimonial ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    
    // Check if testimonial exists
    const testimonial = await db.collection('testimonials').findOne({
      _id: new ObjectId(id)
    })
    
    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      })
    }
    
    // Update testimonial status
    const result = await db.collection('testimonials').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: adminId,
          updatedAt: new Date()
        }
      }
    )
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      })
    }
    
    // Get updated testimonial
    const updatedTestimonial = await db.collection('testimonials').findOne({
      _id: new ObjectId(id)
    })
    
    res.status(200).json({
      success: true,
      message: 'Testimonial approved successfully',
      data: updatedTestimonial
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Reject a testimonial
 */
export const rejectTestimonial = async (req, res, next) => {
  try {
    const { id } = req.params
    const adminId = req.admin?.id // From auth middleware
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid testimonial ID format'
      })
    }
    
    const { db } = await connectToDatabase()
    
    // Check if testimonial exists
    const testimonial = await db.collection('testimonials').findOne({
      _id: new ObjectId(id)
    })
    
    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      })
    }
    
    // Update testimonial status
    const result = await db.collection('testimonials').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'rejected',
          updatedAt: new Date()
        }
      }
    )
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      })
    }
    
    // Get updated testimonial
    const updatedTestimonial = await db.collection('testimonials').findOne({
      _id: new ObjectId(id)
    })
    
    res.status(200).json({
      success: true,
      message: 'Testimonial rejected successfully',
      data: updatedTestimonial
    })
  } catch (error) {
    next(error)
  }
}
