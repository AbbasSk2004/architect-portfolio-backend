/**
 * Validation middleware for testimonials
 */

/**
 * Validate email format
 */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validate create testimonial request
 */
export const validateCreateTestimonial = (req, res, next) => {
  const { fullName, email, review } = req.body
  
  // Check required fields
  if (!fullName || !email || !review) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: fullName, email, and review are required'
    })
  }
  
  // Validate fullName
  if (typeof fullName !== 'string' || fullName.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Full name must be at least 2 characters long'
    })
  }
  
  // Validate email format
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    })
  }
  
  // Validate review
  if (typeof review !== 'string' || review.trim().length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Review must be at least 10 characters long'
    })
  }
  
  // Validate phone number if provided
  if (req.body.phoneNumber && typeof req.body.phoneNumber !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Phone number must be a string'
    })
  }
  
  // Validate project type if provided
  if (req.body.projectType && typeof req.body.projectType !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Project type must be a string'
    })
  }
  
  next()
}

/**
 * Validate update testimonial request
 */
export const validateUpdateTestimonial = (req, res, next) => {
  const { fullName, email, review, phoneNumber, projectType } = req.body
  
  // At least one field must be provided
  if (!fullName && !email && !review && phoneNumber === undefined && projectType === undefined) {
    return res.status(400).json({
      success: false,
      message: 'At least one field must be provided for update'
    })
  }
  
  // Validate fullName if provided
  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full name must be at least 2 characters long'
      })
    }
  }
  
  // Validate email format if provided
  if (email !== undefined && !emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    })
  }
  
  // Validate review if provided
  if (review !== undefined) {
    if (typeof review !== 'string' || review.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Review must be at least 10 characters long'
      })
    }
  }
  
  // Validate phone number if provided
  if (phoneNumber !== undefined && phoneNumber !== null && typeof phoneNumber !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Phone number must be a string or null'
    })
  }
  
  // Validate project type if provided
  if (projectType !== undefined && projectType !== null && typeof projectType !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Project type must be a string or null'
    })
  }
  
  next()
}

/**
 * Validate create career application request
 */
export const validateCreateApplication = (req, res, next) => {
  const { fullName, email, motivationLetter, jobTitle } = req.body
  
  // Check required fields
  if (!fullName || !email || !motivationLetter || !jobTitle) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: fullName, email, motivationLetter, and jobTitle are required'
    })
  }
  
  // Validate fullName
  if (typeof fullName !== 'string' || fullName.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Full name must be at least 2 characters long'
    })
  }
  
  // Validate email format
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    })
  }
  
  // Validate motivation letter
  if (typeof motivationLetter !== 'string' || motivationLetter.trim().length < 20) {
    return res.status(400).json({
      success: false,
      message: 'Motivation letter must be at least 20 characters long'
    })
  }
  
  // Validate job title
  if (typeof jobTitle !== 'string' || jobTitle.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Job title must be at least 2 characters long'
    })
  }
  
  next()
}
