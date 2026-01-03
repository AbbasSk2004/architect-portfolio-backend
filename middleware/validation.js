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

/**
 * Validate inquiry identity (Step 1)
 */
export const validateInquiryIdentity = (req, res, next) => {
  const { clientType, firstName, lastName, email, phone } = req.body
  
  // Validate clientType
  if (clientType && !['private', 'business'].includes(clientType)) {
    return res.status(400).json({
      success: false,
      message: 'Client type must be either "private" or "business"'
    })
  }
  
  // Validate firstName
  if (firstName && (typeof firstName !== 'string' || firstName.trim().length < 1)) {
    return res.status(400).json({
      success: false,
      message: 'First name must be at least 1 character long'
    })
  }
  
  // Validate lastName
  if (lastName && (typeof lastName !== 'string' || lastName.trim().length < 1)) {
    return res.status(400).json({
      success: false,
      message: 'Last name must be at least 1 character long'
    })
  }
  
  // Validate email format if provided
  if (email && !emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    })
  }
  
  // Validate phone if provided
  if (phone && typeof phone !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Phone number must be a string'
    })
  }
  
  next()
}

/**
 * Validate inquiry context (Step 2)
 */
export const validateInquiryContext = (req, res, next) => {
  const { address, selectedServices, budget, timeline, surface, description } = req.body
  
  // Validate address if provided
  if (address && typeof address !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Address must be a string'
    })
  }
  
  // Validate selectedServices if provided
  if (selectedServices && !Array.isArray(selectedServices)) {
    return res.status(400).json({
      success: false,
      message: 'Selected services must be an array'
    })
  }
  
  // Validate budget if provided
  if (budget && (typeof budget !== 'string' && typeof budget !== 'number')) {
    return res.status(400).json({
      success: false,
      message: 'Budget must be a string or number'
    })
  }
  
  // Validate timeline if provided
  if (timeline && !['asap', '3m', '6m', '1y'].includes(timeline)) {
    return res.status(400).json({
      success: false,
      message: 'Timeline must be one of: asap, 3m, 6m, 1y'
    })
  }
  
  // Validate surface if provided
  if (surface && (typeof surface !== 'string' && typeof surface !== 'number')) {
    return res.status(400).json({
      success: false,
      message: 'Surface must be a string or number'
    })
  }
  
  // Validate description if provided
  if (description && typeof description !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Description must be a string'
    })
  }
  
  next()
}