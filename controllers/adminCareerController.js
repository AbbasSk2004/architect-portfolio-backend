import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'

/**
 * Get all career applications (admin) with filtering, pagination, and search
 * GET /admin/career
 */
export const getAdminApplications = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 25, 
      q = '', 
      status = '', 
      jobTitle = '',
      sort = 'createdAt',
      order = 'desc'
    } = req.query

    const { db } = await connectToDatabase()
    const collection = db.collection('career_applications')

    // Build query
    const query = {}

    // Search query (name, email, job title)
    if (q && q.trim()) {
      query.$or = [
        { fullName: { $regex: q.trim(), $options: 'i' } },
        { email: { $regex: q.trim(), $options: 'i' } },
        { jobTitle: { $regex: q.trim(), $options: 'i' } }
      ]
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status
    }

    // Job title filter
    if (jobTitle && jobTitle.trim()) {
      query.jobTitle = jobTitle.trim()
    }

    // Pagination
    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    // Sort
    const sortOrder = order === 'asc' ? 1 : -1
    const sortObj = { [sort]: sortOrder }

    // Get total count
    const total = await collection.countDocuments(query)

    // Get applications
    const applications = await collection
      .find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .toArray()

    // Get unique job titles for filter dropdown
    const jobTitles = await collection.distinct('jobTitle')

    res.status(200).json({
      success: true,
      data: applications,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      filters: {
        jobTitles: jobTitles.filter(Boolean).sort()
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get a single application by ID (admin)
 * GET /admin/career/:id
 */
export const getAdminApplicationById = async (req, res, next) => {
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
 * Update application status (admin)
 * PATCH /admin/career/:id/status
 */
export const updateAdminApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status, adminNote } = req.body

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
    const collection = db.collection('career_applications')

    // Get current application to check if status is changing from pending
    const currentApp = await collection.findOne({ _id: new ObjectId(id) })
    if (!currentApp) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      })
    }

    const isStatusChanging = currentApp.status !== status
    const isChangingFromPending = currentApp.status === 'pending' && status !== 'pending'

    // Build update object
    const updateData = {
      status,
      updatedAt: new Date()
    }

    // Add reviewedAt if changing from pending
    if (isChangingFromPending) {
      updateData.reviewedAt = new Date()
      updateData.reviewedBy = {
        id: req.admin.id,
        email: req.admin.email
      }
    }

    // Add admin note if provided
    if (adminNote !== undefined) {
      updateData.adminNote = adminNote.trim() || null
    }

    // Update application
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      })
    }

    // Get updated application
    const updatedApplication = await collection.findOne({
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
 * Bulk update application status (admin)
 * PATCH /admin/career/bulk-status
 */
export const bulkUpdateAdminApplicationStatus = async (req, res, next) => {
  try {
    const { ids, status } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'IDs array is required and must not be empty'
      })
    }

    const validStatuses = ['pending', 'reviewed', 'accepted', 'rejected']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      })
    }

    // Validate all IDs are valid ObjectIds
    const validIds = ids.filter(id => ObjectId.isValid(id))
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid application IDs provided'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('career_applications')

    // Convert to ObjectIds
    const objectIds = validIds.map(id => new ObjectId(id))

    // Get current applications to check which are changing from pending
    const currentApps = await collection.find({
      _id: { $in: objectIds }
    }).toArray()

    const now = new Date()
    const updateData = {
      status,
      updatedAt: now
    }

    // For apps changing from pending, add reviewedAt and reviewedBy
    const appsChangingFromPending = currentApps.filter(
      app => app.status === 'pending' && status !== 'pending'
    )

    if (appsChangingFromPending.length > 0) {
      const reviewedIds = appsChangingFromPending.map(app => app._id)
      
      await collection.updateMany(
        { _id: { $in: reviewedIds } },
        {
          $set: {
            ...updateData,
            reviewedAt: now,
            reviewedBy: {
              id: req.admin.id,
              email: req.admin.email
            }
          }
        }
      )
    }

    // Update remaining apps
    const remainingIds = objectIds.filter(
      id => !appsChangingFromPending.some(app => app._id.equals(id))
    )

    if (remainingIds.length > 0) {
      await collection.updateMany(
        { _id: { $in: remainingIds } },
        { $set: updateData }
      )
    }

    // Get updated count
    const updatedCount = await collection.countDocuments({
      _id: { $in: objectIds },
      status: status
    })

    res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedCount} application(s)`,
      data: {
        updated: updatedCount,
        total: validIds.length
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Export applications to CSV (admin)
 * GET /admin/career/export
 */
export const exportAdminApplications = async (req, res, next) => {
  try {
    const { ids, status } = req.query

    const { db } = await connectToDatabase()
    const collection = db.collection('career_applications')

    // Build query
    const query = {}

    if (ids) {
      // Export specific IDs
      const idArray = ids.split(',').filter(id => ObjectId.isValid(id))
      if (idArray.length > 0) {
        query._id = { $in: idArray.map(id => new ObjectId(id)) }
      }
    } else if (status && status !== 'all') {
      // Export by status
      query.status = status
    }

    // Get applications
    const applications = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()

    // Generate CSV
    const headers = ['Full Name', 'Email', 'Job Title', 'Status', 'Applied At', 'CV URL']
    const rows = applications.map(app => [
      app.fullName || '',
      app.email || '',
      app.jobTitle || '',
      app.status || 'pending',
      app.createdAt ? new Date(app.createdAt).toISOString() : '',
      app.cvUrl || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    // Set response headers
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="career-applications-${Date.now()}.csv"`)
    
    res.status(200).send(csv)
  } catch (error) {
    next(error)
  }
}

/**
 * Download CV or Portfolio (admin)
 * GET /admin/career/:id/download?type=cv|portfolio
 */
export const downloadAdminApplicationFile = async (req, res, next) => {
  try {
    const { id } = req.params
    const { type = 'cv' } = req.query

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid application ID format'
      })
    }

    if (type !== 'cv' && type !== 'portfolio') {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "cv" or "portfolio"'
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

    const fileUrl = type === 'cv' ? application.cvUrl : application.portfolioUrl

    if (!fileUrl) {
      return res.status(404).json({
        success: false,
        message: `${type === 'cv' ? 'CV' : 'Portfolio'} not found for this application`
      })
    }

    // Redirect to Cloudinary URL (admin-only endpoint ensures security)
    res.redirect(fileUrl)
  } catch (error) {
    next(error)
  }
}
