import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'
import { deleteImageFromCloudinary } from '../middleware/upload.js'

/**
 * Generate slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Validate HTTPS URL
 */
function isValidHttpsUrl(url) {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Get all news (admin) - includes drafts
 * GET /api/admin/news
 */
export const getAdminNews = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 25, 
      q = '', 
      status = '', 
      source = '',
      sort = 'publishedAt',
      order = 'desc'
    } = req.query

    const { db } = await connectToDatabase()
    const collection = db.collection('news')

    // Build query
    const query = {}
    
    // Search query (title, excerpt, content, source)
    if (q && q.trim()) {
      query.$or = [
        { title: { $regex: q.trim(), $options: 'i' } },
        { excerpt: { $regex: q.trim(), $options: 'i' } },
        { content: { $regex: q.trim(), $options: 'i' } },
        { source: { $regex: q.trim(), $options: 'i' } }
      ]
    }
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status
    }
    
    // Source filter
    if (source && source.trim()) {
      query.source = source.trim()
    }

    // Calculate pagination
    const pageNum = parseInt(page, 10) || 1
    const limitNum = parseInt(limit, 10) || 25
    const skip = (pageNum - 1) * limitNum

    // Sort order
    const sortOrder = order === 'asc' ? 1 : -1
    const sortObj = { [sort]: sortOrder }

    // Get total count
    const total = await collection.countDocuments(query)

    // Get news
    const news = await collection
      .find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .toArray()

    // Get unique sources for filters
    const sourcesPipeline = [
      { $match: query },
      { $group: { _id: '$source' } },
      { $sort: { _id: 1 } }
    ]
    const sourcesResult = await collection.aggregate(sourcesPipeline).toArray()
    const sources = sourcesResult.map(item => item._id).filter(Boolean)

    res.status(200).json({
      success: true,
      data: {
        data: news,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        },
        filters: {
          sources
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get single news by ID (admin)
 * GET /api/admin/news/:id
 */
export const getAdminNewsById = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid news ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('news')

    const news = await collection.findOne({ _id: new ObjectId(id) })

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      })
    }

    res.status(200).json({
      success: true,
      data: news
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create new news (admin)
 * POST /api/admin/news
 */
export const createNews = async (req, res, next) => {
  try {
    // Get uploaded cover image from Cloudinary middleware (if file was uploaded)
    const uploadedCover = req.uploadedNewsCover || null
    
    // Get news data from body
    const {
      title,
      source,
      excerpt,
      content,
      coverImageUrl,
      publishedAt,
      status = 'draft'
    } = req.body

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      })
    }

    if (!source || !source.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Source is required'
      })
    }

    if (!excerpt || !excerpt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Excerpt is required'
      })
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      })
    }

    // Handle cover image
    let coverImage = null
    
    if (uploadedCover) {
      // File was uploaded to Cloudinary
      coverImage = uploadedCover
    } else if (coverImageUrl && coverImageUrl.trim()) {
      // External URL provided
      const url = coverImageUrl.trim()
      if (!isValidHttpsUrl(url)) {
        return res.status(400).json({
          success: false,
          message: 'Cover image URL must be a valid HTTPS URL'
        })
      }
      coverImage = {
        url,
        source: 'external'
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Cover image is required (upload file or provide URL)'
      })
    }

    // Parse publishedAt date
    let publishedAtDate = new Date()
    if (publishedAt) {
      const parsedDate = new Date(publishedAt)
      if (!isNaN(parsedDate.getTime())) {
        publishedAtDate = parsedDate
      }
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('news')

    // Generate slug from title
    let newsSlug = generateSlug(title)

    // Ensure slug is unique
    let slugExists = await collection.findOne({ slug: newsSlug })
    let slugCounter = 1
    const originalSlug = newsSlug
    while (slugExists) {
      newsSlug = `${originalSlug}-${slugCounter}`
      slugExists = await collection.findOne({ slug: newsSlug })
      slugCounter++
    }

    // Prepare news data
    const newsData = {
      title: title.trim(),
      slug: newsSlug,
      source: source.trim(),
      excerpt: excerpt.trim(),
      content: content.trim(),
      coverImage,
      publishedAt: publishedAtDate,
      status: status === 'published' ? 'published' : 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(newsData)

    res.status(201).json({
      success: true,
      message: 'News created successfully',
      data: {
        _id: result.insertedId,
        ...newsData
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update news (admin)
 * PUT /api/admin/news/:id
 */
export const updateNews = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Get uploaded cover image from Cloudinary middleware (if file was uploaded)
    const uploadedCover = req.uploadedNewsCover
    
    // Get news data from body
    const {
      title,
      source,
      excerpt,
      content,
      coverImageUrl,
      publishedAt,
      status,
      deletedCoverImage = false
    } = req.body

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid news ID'
      })
    }

    // Validation
    if (title && !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty'
      })
    }

    if (source && !source.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Source cannot be empty'
      })
    }

    if (excerpt && !excerpt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Excerpt cannot be empty'
      })
    }

    if (content && !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Content cannot be empty'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('news')

    // Check if news exists
    const existingNews = await collection.findOne({ _id: new ObjectId(id) })
    if (!existingNews) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      })
    }

    // Build update object
    const updateData = {
      updatedAt: new Date()
    }

    if (title) updateData.title = title.trim()
    if (source) updateData.source = source.trim()
    if (excerpt) updateData.excerpt = excerpt.trim()
    if (content) updateData.content = content.trim()
    if (status !== undefined) updateData.status = status === 'published' ? 'published' : 'draft'

    // Handle publishedAt date
    if (publishedAt !== undefined) {
      const parsedDate = new Date(publishedAt)
      if (!isNaN(parsedDate.getTime())) {
        updateData.publishedAt = parsedDate
      } else {
        updateData.publishedAt = existingNews.publishedAt
      }
    }

    // Handle slug update if title changed
    if (title && title.trim() !== existingNews.title) {
      let newsSlug = generateSlug(title.trim())
      
      // Check if slug is unique (excluding current news)
      if (newsSlug !== existingNews.slug) {
        let slugExists = await collection.findOne({ 
          slug: newsSlug,
          _id: { $ne: new ObjectId(id) }
        })
        let slugCounter = 1
        const originalSlug = newsSlug
        while (slugExists) {
          newsSlug = `${originalSlug}-${slugCounter}`
          slugExists = await collection.findOne({ 
            slug: newsSlug,
            _id: { $ne: new ObjectId(id) }
          })
          slugCounter++
        }
        updateData.slug = newsSlug
      }
    }

    // Handle cover image
    if (uploadedCover) {
      // New file uploaded - delete old Cloudinary image if exists
      if (existingNews.coverImage && existingNews.coverImage.source === 'cloudinary') {
        try {
          await deleteImageFromCloudinary(existingNews.coverImage.url)
        } catch (error) {
          console.error('Error deleting old cover image (non-critical):', error)
        }
      }
      updateData.coverImage = uploadedCover
    } else if (coverImageUrl !== undefined) {
      // URL provided or cover image deleted
      if (deletedCoverImage) {
        // Delete old Cloudinary image if exists
        if (existingNews.coverImage && existingNews.coverImage.source === 'cloudinary') {
          try {
            await deleteImageFromCloudinary(existingNews.coverImage.url)
          } catch (error) {
            console.error('Error deleting old cover image (non-critical):', error)
          }
        }
        updateData.coverImage = null
      } else if (coverImageUrl && coverImageUrl.trim()) {
        // New external URL provided
        const url = coverImageUrl.trim()
        if (!isValidHttpsUrl(url)) {
          return res.status(400).json({
            success: false,
            message: 'Cover image URL must be a valid HTTPS URL'
          })
        }
        // Delete old Cloudinary image if exists
        if (existingNews.coverImage && existingNews.coverImage.source === 'cloudinary') {
          try {
            await deleteImageFromCloudinary(existingNews.coverImage.url)
          } catch (error) {
            console.error('Error deleting old cover image (non-critical):', error)
          }
        }
        updateData.coverImage = {
          url,
          source: 'external'
        }
      } else {
        // Keep existing cover image
        updateData.coverImage = existingNews.coverImage
      }
    }

    // Update news
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      })
    }

    // Fetch updated news
    const updatedNews = await collection.findOne({ _id: new ObjectId(id) })

    res.status(200).json({
      success: true,
      message: 'News updated successfully',
      data: updatedNews
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete news (admin)
 * DELETE /api/admin/news/:id
 * Also deletes cover image from Cloudinary if source is cloudinary
 */
export const deleteNews = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid news ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('news')

    // Get news first to delete cover image from Cloudinary
    const news = await collection.findOne({ _id: new ObjectId(id) })
    
    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      })
    }

    // Delete cover image from Cloudinary if source is cloudinary
    if (news.coverImage && news.coverImage.source === 'cloudinary') {
      try {
        await deleteImageFromCloudinary(news.coverImage.url)
      } catch (error) {
        console.error('Error deleting cover image from Cloudinary (non-critical):', error)
      }
    }

    // Delete news from database
    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      })
    }

    res.status(200).json({
      success: true,
      message: 'News deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Publish news (admin)
 * PATCH /api/admin/news/:id/publish
 */
export const publishNews = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid news ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('news')

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'published',
          updatedAt: new Date()
        } 
      }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      })
    }

    const updatedNews = await collection.findOne({ _id: new ObjectId(id) })

    res.status(200).json({
      success: true,
      message: 'News published successfully',
      data: updatedNews
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Unpublish news (admin)
 * PATCH /api/admin/news/:id/unpublish
 */
export const unpublishNews = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid news ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('news')

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          status: 'draft',
          updatedAt: new Date()
        } 
      }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'News not found'
      })
    }

    const updatedNews = await collection.findOne({ _id: new ObjectId(id) })

    res.status(200).json({
      success: true,
      message: 'News unpublished successfully',
      data: updatedNews
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get all published news (public)
 * GET /api/news
 */
export const getPublishedNews = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      source = '',
      sort = 'publishedAt',
      order = 'desc'
    } = req.query

    const { db } = await connectToDatabase()
    const collection = db.collection('news')

    // Build query - ONLY published news
    const query = { status: 'published' }
    
    // Source filter
    if (source && source.trim()) {
      query.source = source.trim()
    }

    // Calculate pagination
    const pageNum = parseInt(page, 10) || 1
    const limitNum = parseInt(limit, 10) || 20
    const skip = (pageNum - 1) * limitNum

    // Sort order
    const sortOrder = order === 'asc' ? 1 : -1
    const sortObj = { [sort]: sortOrder }

    // Get total count
    const total = await collection.countDocuments(query)

    // Get news
    const news = await collection
      .find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .toArray()

    res.status(200).json({
      success: true,
      data: {
        data: news,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get news by slug (public)
 * GET /api/news/:slug
 */
export const getNewsBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params

    if (!slug || !slug.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Slug is required'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('news')

    // Find news by slug - MUST be published
    const news = await collection.findOne({ 
      slug: slug.trim(),
      status: 'published'
    })

    if (!news) {
      return res.status(404).json({
        success: false,
        message: 'News not found or not published'
      })
    }

    res.status(200).json({
      success: true,
      data: news
    })
  } catch (error) {
    next(error)
  }
}
