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

// File filter for project images (images only)
const projectImageFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'), false)
  }
}

// Multer configuration for project images
const uploadProjectImages = multer({
  storage: memoryStorage,
  fileFilter: projectImageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 20 // Maximum 20 files at once
  }
})

// Middleware for project image uploads (multiple fields)
export const uploadProjectImagesMulter = uploadProjectImages.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'images', maxCount: 20 },
  { name: 'plans', maxCount: 20 }
])

// Middleware to upload project images to Cloudinary
export const uploadProjectImagesToCloudinary = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      req.uploadedProjectImages = {}
      return next()
    }

    const uploadPromises = []
    const uploadedImages = {
      coverImage: null,
      images: [],
      plans: []
    }

    // Upload cover image if present
    if (req.files.coverImage && req.files.coverImage[0]) {
      const coverFile = req.files.coverImage[0]
      const uploadPromise = new Promise((resolve, reject) => {
        const timestamp = Date.now()
        const originalName = coverFile.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_')
        const publicId = `project_cover_${timestamp}_${originalName}`
        
        const uploadOptions = {
          folder: 'architect-portfolio/projects',
          resource_type: 'image',
          public_id: publicId,
          format: 'auto',
          quality: 'auto',
        }
        
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('Cover image upload error:', error)
              reject(error)
            } else {
              resolve({ field: 'coverImage', url: result.secure_url, publicId: result.public_id })
            }
          }
        ).end(coverFile.buffer)
      })
      uploadPromises.push(uploadPromise)
    }

    // Upload gallery images if present
    if (req.files.images && req.files.images.length > 0) {
      req.files.images.forEach((imageFile) => {
        const uploadPromise = new Promise((resolve, reject) => {
          const timestamp = Date.now()
          const random = Math.random().toString(36).substring(2, 9)
          const originalName = imageFile.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_')
          const publicId = `project_image_${timestamp}_${random}_${originalName}`
          
          const uploadOptions = {
            folder: 'architect-portfolio/projects',
            resource_type: 'image',
            public_id: publicId,
            format: 'auto',
            quality: 'auto',
          }
          
          cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                console.error('Gallery image upload error:', error)
                reject(error)
              } else {
                resolve({ field: 'images', url: result.secure_url, publicId: result.public_id })
              }
            }
          ).end(imageFile.buffer)
        })
        uploadPromises.push(uploadPromise)
      })
    }

    // Upload plans if present
    if (req.files.plans && req.files.plans.length > 0) {
      req.files.plans.forEach((planFile) => {
        const uploadPromise = new Promise((resolve, reject) => {
          const timestamp = Date.now()
          const random = Math.random().toString(36).substring(2, 9)
          const originalName = planFile.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_')
          const publicId = `project_plan_${timestamp}_${random}_${originalName}`
          
          const uploadOptions = {
            folder: 'architect-portfolio/projects/plans',
            resource_type: 'image',
            public_id: publicId,
            format: 'auto',
            quality: 'auto',
          }
          
          cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                console.error('Plan image upload error:', error)
                reject(error)
              } else {
                resolve({ field: 'plans', url: result.secure_url, publicId: result.public_id })
              }
            }
          ).end(planFile.buffer)
        })
        uploadPromises.push(uploadPromise)
      })
    }

    if (uploadPromises.length === 0) {
      req.uploadedProjectImages = uploadedImages
      return next()
    }

    const results = await Promise.all(uploadPromises)
    
    // Organize results by field
    results.forEach(result => {
      if (result.field === 'coverImage') {
        uploadedImages.coverImage = result.url
      } else if (result.field === 'images') {
        uploadedImages.images.push(result.url)
      } else if (result.field === 'plans') {
        uploadedImages.plans.push(result.url)
      }
    })

    req.uploadedProjectImages = uploadedImages
    next()
  } catch (error) {
    console.error('Project images upload error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to upload images to cloud storage',
      error: error.message
    })
  }
}

// Helper function to extract public_id from Cloudinary URL
export function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  
  try {
    // Cloudinary URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{folder}/{public_id}.{format}
    // or: https://res.cloudinary.com/{cloud_name}/image/upload/{folder}/{public_id}.{format}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^/.]+)?$/)
    if (match && match[1]) {
      // Remove file extension if present
      return match[1].replace(/\.[^/.]+$/, '')
    }
  } catch (error) {
    console.error('Error extracting public_id from URL:', error)
  }
  
  return null
}

// Helper function to delete image from Cloudinary
export async function deleteImageFromCloudinary(url) {
  const publicId = extractPublicIdFromUrl(url)
  if (!publicId) {
    console.warn('Could not extract public_id from URL:', url)
    return false
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image'
    })
    
    if (result.result === 'ok' || result.result === 'not found') {
      return true
    }
    
    console.warn('Failed to delete image from Cloudinary:', result)
    return false
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error)
    return false
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

