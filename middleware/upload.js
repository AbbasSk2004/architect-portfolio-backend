import multer from 'multer'
import cloudinary from '../config/cloudinary.js'
import { CloudinaryStorage } from 'multer-storage-cloudinary'

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'architect-portfolio/career',
      resource_type: 'raw', // Use 'raw' for PDFs
      allowed_formats: ['pdf'],
      format: 'pdf',
    }
  }
})

// File filter for PDFs only
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true)
  } else {
    cb(new Error('Only PDF files are allowed'), false)
  }
}

// Configure multer with memory storage for Cloudinary
const memoryStorage = multer.memoryStorage()

const upload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
})

// Middleware to upload files to Cloudinary (for career applications)
export const uploadToCloudinary = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return next()
    }

    const uploadPromises = []

    // Upload CV if present
    if (req.files.cv && req.files.cv[0]) {
      const cvFile = req.files.cv[0]
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadOptions = {
          folder: 'architect-portfolio/career',
          resource_type: 'raw',
          public_id: `cv_${Date.now()}_${cvFile.originalname.replace(/\.[^/.]+$/, '')}`,
        }
        
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('CV upload error:', error)
              reject(error)
            } else {
              resolve({ field: 'cv', url: result.secure_url })
            }
          }
        ).end(cvFile.buffer)
      })
      uploadPromises.push(uploadPromise)
    }

    // Upload Portfolio if present
    if (req.files.portfolio && req.files.portfolio[0]) {
      const portfolioFile = req.files.portfolio[0]
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadOptions = {
          folder: 'architect-portfolio/career',
          resource_type: 'raw',
          public_id: `portfolio_${Date.now()}_${portfolioFile.originalname.replace(/\.[^/.]+$/, '')}`,
        }
        
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('Portfolio upload error:', error)
              reject(error)
            } else {
              resolve({ field: 'portfolio', url: result.secure_url })
            }
          }
        ).end(portfolioFile.buffer)
      })
      uploadPromises.push(uploadPromise)
    }

    if (uploadPromises.length === 0) {
      return next()
    }

    const results = await Promise.all(uploadPromises)
    
    // Attach URLs to request
    req.uploadedFiles = {}
    results.forEach(result => {
      req.uploadedFiles[result.field] = result.url
    })

    next()
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to upload files to cloud storage',
      error: error.message
    })
  }
}

// Middleware for multiple file uploads
export const uploadMultiple = upload.fields([
  { name: 'cv', maxCount: 1 },
  { name: 'portfolio', maxCount: 1 }
])

// File filter for inquiry documents (images and PDFs)
const inquiryFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only PDF, JPEG, PNG, GIF, and WebP files are allowed'), false)
  }
}

// Multer configuration for inquiry documents
const uploadInquiry = multer({
  storage: memoryStorage,
  fileFilter: inquiryFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files
  }
})

// Middleware for inquiry document uploads
export const uploadInquiryDocuments = uploadInquiry.array('documents', 10)

// Middleware to upload inquiry documents to Cloudinary
export const uploadInquiryDocumentsToCloudinary = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      req.uploadedFiles = { documents: [] }
      return next()
    }

    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        // Determine resource type based on file type
        const isImage = file.mimetype.startsWith('image/')
        const resourceType = isImage ? 'image' : 'raw'
        
        // Generate unique public_id
        const timestamp = Date.now()
        const originalName = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_')
        const publicId = `inquiry_${timestamp}_${originalName}`
        
        const uploadOptions = {
          folder: 'architect-portfolio/inquiries',
          resource_type: resourceType,
          public_id: publicId,
        }
        
        // For images, allow format conversion
        if (isImage) {
          uploadOptions.format = 'auto'
          uploadOptions.quality = 'auto'
        }
        
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('Document upload error:', error)
              reject(error)
            } else {
              resolve(result.secure_url)
            }
          }
        ).end(file.buffer)
      })
    })

    const urls = await Promise.all(uploadPromises)
    
    // Attach URLs to request
    req.uploadedFiles = {
      documents: urls
    }

    next()
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to upload documents to cloud storage',
      error: error.message
    })
  }
}

// Error handler for multer errors
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 10MB limit'
      })
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded'
      })
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    })
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error'
    })
  }
  
  next()
}

