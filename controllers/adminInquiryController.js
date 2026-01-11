import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'

/**
 * Get all inquiries (admin) with filtering, pagination, and search
 * GET /api/admin/inquiries
 */
export const getAdminInquiries = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 25, 
      q = '', 
      status = '', 
      clientType = '',
      service = '',
      paymentStatus = '',
      dateFrom = '',
      dateTo = '',
      sort = 'createdAt',
      order = 'desc'
    } = req.query

    const { db } = await connectToDatabase()
    const collection = db.collection('inquiries')

    // Build query
    const query = {}

    // Search query (name, email, phone)
    if (q && q.trim()) {
      query.$or = [
        { firstName: { $regex: q.trim(), $options: 'i' } },
        { lastName: { $regex: q.trim(), $options: 'i' } },
        { email: { $regex: q.trim(), $options: 'i' } },
        { phone: { $regex: q.trim(), $options: 'i' } }
      ]
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status
    }

    // Client type filter
    if (clientType && clientType !== 'all') {
      query.clientType = clientType
    }

    // Service filter (check if service is in selectedServices array)
    if (service && service.trim()) {
      query.selectedServices = { $in: [service.trim()] }
    }

    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      if (paymentStatus === 'none') {
        query.$or = [
          { paymentStatus: { $exists: false } },
          { paymentStatus: null },
          { paymentStatus: '' }
        ]
      } else {
        query.paymentStatus = paymentStatus
      }
    }

    // Date range filter (createdAt)
    if (dateFrom || dateTo) {
      query.createdAt = {}
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999) // End of day
        query.createdAt.$lte = endDate
      }
    }

    // Pagination
    const pageNum = parseInt(page, 10) || 1
    const limitNum = parseInt(limit, 10) || 25
    const skip = (pageNum - 1) * limitNum

    // Sort
    const sortOrder = order === 'asc' ? 1 : -1
    const sortObj = { [sort]: sortOrder }

    // Get total count
    const total = await collection.countDocuments(query)

    // Get inquiries
    const inquiries = await collection
      .find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .toArray()

    // Get unique values for filters using aggregation
    let statuses = []
    let services = []
    
    try {
      // Get unique statuses
      const statusAggregation = await collection.aggregate([
        { $match: { status: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$status' } },
        { $sort: { _id: 1 } }
      ]).toArray()
      statuses = statusAggregation.map(item => item._id).filter(Boolean)

      // Get unique services (flatten selectedServices arrays)
      const servicesAggregation = await collection.aggregate([
        { $match: { selectedServices: { $exists: true, $ne: null, $ne: [] } } },
        { $unwind: '$selectedServices' },
        { $group: { _id: '$selectedServices' } },
        { $sort: { _id: 1 } }
      ]).toArray()
      services = servicesAggregation.map(item => item._id).filter(Boolean)
    } catch (aggError) {
      console.error('Error fetching filter options:', aggError)
    }

    res.status(200).json({
      success: true,
      data: {
        data: inquiries || [],
        pagination: {
          total: total || 0,
          page: pageNum || 1,
          limit: limitNum || 25,
          totalPages: Math.ceil((total || 0) / (limitNum || 25))
        },
        filters: {
          statuses: statuses || [],
          services: services || []
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get a single inquiry by ID (admin)
 * GET /api/admin/inquiries/:id
 */
export const getAdminInquiryById = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inquiry ID format'
      })
    }

    const { db } = await connectToDatabase()
    const inquiry = await db.collection('inquiries').findOne({
      _id: new ObjectId(id)
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
 * Update inquiry status (admin)
 * PATCH /api/admin/inquiries/:id/status
 */
export const updateAdminInquiryStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status, adminNote } = req.body

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inquiry ID format'
      })
    }

    // Validate status
    const validStatuses = [
      'draft',
      'submitted',
      'reviewed',
      'consultation_pending_payment',
      'payment_pending',
      'paid',
      'invoice_finalized',
      'completed',
      'cancelled'
    ]

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      })
    }

    const { db } = await connectToDatabase()
    const inquiry = await db.collection('inquiries').findOne({
      _id: new ObjectId(id)
    })

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      })
    }

    const updateData = {
      updatedAt: new Date()
    }

    if (status) {
      updateData.status = status
      
      // Set reviewedAt if status changed to reviewed
      if (status === 'reviewed' && inquiry.status !== 'reviewed') {
        updateData.reviewedAt = new Date()
        updateData.reviewedBy = {
          id: req.admin?.id || null,
          email: req.admin?.email || null
        }
      }
    }

    // Update admin notes
    if (adminNote !== undefined) {
      // Initialize adminNotes array if it doesn't exist
      const currentNotes = inquiry.adminNotes || []
      if (adminNote && adminNote.trim()) {
        // Add new note
        const newNote = {
          text: adminNote.trim(),
          author: {
            id: req.admin?.id || null,
            email: req.admin?.email || null
          },
          createdAt: new Date()
        }
        updateData.adminNotes = [...currentNotes, newNote]
      } else {
        // Keep existing notes
        updateData.adminNotes = currentNotes
      }
    }

    const result = await db.collection('inquiries').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      })
    }

    const updatedInquiry = await db.collection('inquiries').findOne({
      _id: new ObjectId(id)
    })

    res.status(200).json({
      success: true,
      message: 'Inquiry status updated successfully',
      data: updatedInquiry
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Bulk update inquiry status (admin)
 * PATCH /api/admin/inquiries/bulk-status
 */
export const bulkUpdateAdminInquiryStatus = async (req, res, next) => {
  try {
    const { ids, status } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'IDs array is required and must not be empty'
      })
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      })
    }

    // Validate status
    const validStatuses = [
      'draft',
      'submitted',
      'reviewed',
      'consultation_pending_payment',
      'payment_pending',
      'paid',
      'invoice_finalized',
      'completed',
      'cancelled'
    ]

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      })
    }

    // Validate all IDs
    const objectIds = ids
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id))

    if (objectIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid inquiry IDs provided'
      })
    }

    const { db } = await connectToDatabase()

    const updateData = {
      status,
      updatedAt: new Date()
    }

    // If status is reviewed, set reviewedAt and reviewedBy
    if (status === 'reviewed') {
      updateData.reviewedAt = new Date()
      updateData.reviewedBy = {
        id: req.admin?.id || null,
        email: req.admin?.email || null
      }
    }

    const result = await db.collection('inquiries').updateMany(
      { _id: { $in: objectIds } },
      { $set: updateData }
    )

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} inquiry/inquiries`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete inquiry (admin)
 * DELETE /api/admin/inquiries/:id
 */
export const deleteAdminInquiry = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid inquiry ID format'
      })
    }

    const { db } = await connectToDatabase()
    const result = await db.collection('inquiries').deleteOne({
      _id: new ObjectId(id)
    })

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inquiry not found'
      })
    }

    res.status(200).json({
      success: true,
      message: 'Inquiry deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Export inquiries to CSV (admin)
 * GET /api/admin/inquiries/export
 */
export const exportAdminInquiries = async (req, res, next) => {
  try {
    const { 
      status = '',
      clientType = '',
      service = '',
      paymentStatus = '',
      dateFrom = '',
      dateTo = ''
    } = req.query

    const { db } = await connectToDatabase()
    const collection = db.collection('inquiries')

    // Build query (same as getAdminInquiries)
    const query = {}

    if (status && status !== 'all') {
      query.status = status
    }

    if (clientType && clientType !== 'all') {
      query.clientType = clientType
    }

    if (service && service.trim()) {
      query.selectedServices = { $in: [service.trim()] }
    }

    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      if (paymentStatus === 'none') {
        query.$or = [
          { paymentStatus: { $exists: false } },
          { paymentStatus: null },
          { paymentStatus: '' }
        ]
      } else {
        query.paymentStatus = paymentStatus
      }
    }

    if (dateFrom || dateTo) {
      query.createdAt = {}
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom)
      }
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        query.createdAt.$lte = endDate
      }
    }

    // Get all matching inquiries
    const inquiries = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()

    // Generate CSV
    const headers = [
      'ID',
      'Created At',
      'Client Name',
      'Client Type',
      'Email',
      'Phone',
      'Address',
      'Services',
      'Budget',
      'Timeline',
      'Surface',
      'Status',
      'Payment Status',
      'Invoice Status',
      'Stripe Customer ID',
      'Stripe Invoice ID',
      'Submitted At',
      'Paid At',
      'Billing Collected At'
    ]

    const rows = inquiries.map(inquiry => {
      const fullName = `${inquiry.firstName || ''} ${inquiry.lastName || ''}`.trim()
      const services = Array.isArray(inquiry.selectedServices) 
        ? inquiry.selectedServices.join('; ') 
        : ''
      
      return [
        inquiry._id?.toString() || '',
        inquiry.createdAt ? new Date(inquiry.createdAt).toISOString() : '',
        fullName,
        inquiry.clientType || '',
        inquiry.email || '',
        inquiry.phone || '',
        inquiry.address || '',
        services,
        inquiry.budget || '',
        inquiry.timeline || '',
        inquiry.surface || '',
        inquiry.status || '',
        inquiry.paymentStatus || '',
        inquiry.invoiceStatus || '',
        inquiry.stripeCustomerId || '',
        inquiry.stripeInvoiceId || '',
        inquiry.submittedAt ? new Date(inquiry.submittedAt).toISOString() : '',
        inquiry.paidAt ? new Date(inquiry.paidAt).toISOString() : '',
        inquiry.billingCollectedAt ? new Date(inquiry.billingCollectedAt).toISOString() : ''
      ]
    })

    // Convert to CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape commas and quotes in CSV
        const cellStr = String(cell || '')
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`
        }
        return cellStr
      }).join(','))
    ].join('\n')

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="inquiries-${new Date().toISOString().split('T')[0]}.csv"`)
    res.status(200).send(csvContent)
  } catch (error) {
    next(error)
  }
}
