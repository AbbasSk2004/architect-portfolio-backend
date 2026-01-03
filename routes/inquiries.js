import express from 'express'
import {
  createInquiryIdentity,
  updateInquiryContext,
  updateInquiryPath,
  submitGeneralInquiry,
  updateConsultationDetails,
  getInquiryById,
  getAllInquiries
} from '../controllers/inquiryController.js'
import { validateInquiryIdentity, validateInquiryContext } from '../middleware/validation.js'
import { uploadInquiryDocuments, uploadInquiryDocumentsToCloudinary, handleUploadError } from '../middleware/upload.js'

const router = express.Router()

// GET all inquiries (admin)
router.get('/', getAllInquiries)

// GET inquiry by ID
router.get('/:inquiryId', getInquiryById)

// POST create inquiry identity (Step 1)
router.post('/', validateInquiryIdentity, createInquiryIdentity)

// PUT update inquiry context (Step 2)
router.put(
  '/:inquiryId/context',
  uploadInquiryDocuments,
  handleUploadError,
  uploadInquiryDocumentsToCloudinary,
  validateInquiryContext,
  updateInquiryContext
)

// PUT update inquiry path (Step 3)
router.put('/:inquiryId/path', updateInquiryPath)

// PUT update consultation details (Step 4 - Consultation)
router.put('/:inquiryId/consultation', updateConsultationDetails)

// POST submit general inquiry (Step 4 - General)
router.post('/:inquiryId/submit', submitGeneralInquiry)

export default router

