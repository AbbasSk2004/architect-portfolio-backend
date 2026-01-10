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
 * Get all blogs (admin) - includes drafts
 * GET /api/admin/blogs
 */
export const getAdminBlogs = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 25, 
      q = '', 
      status = '', 
      category = '',
      sort = 'createdAt',
      order = 'desc'
    } = req.query

    const { db } = await connectToDatabase()
    const collection = db.collection('blogs')

    // Build query
    const query = {}
    
    // Search query (title, excerpt, content)
    if (q && q.trim()) {
      query.$or = [
        { title: { $regex: q.trim(), $options: 'i' } },
        { excerpt: { $regex: q.trim(), $options: 'i' } },
        { content: { $regex: q.trim(), $options: 'i' } }
      ]
    }
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status
    }
    
    // Category filter
    if (category && category.trim()) {
      query.category = category.trim()
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

    // Get blogs
    const blogs = await collection
      .find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .toArray()

    // Get unique categories for filters
    const categoriesPipeline = [
      { $match: query },
      { $group: { _id: '$category' } },
      { $sort: { _id: 1 } }
    ]
    const categoriesResult = await collection.aggregate(categoriesPipeline).toArray()
    const categories = categoriesResult.map(item => item._id).filter(Boolean)

    res.status(200).json({
      success: true,
      data: {
        data: blogs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        },
        filters: {
          categories
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get single blog by ID (admin)
 * GET /api/admin/blogs/:id
 */
export const getAdminBlogById = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('blogs')

    const blog = await collection.findOne({ _id: new ObjectId(id) })

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      })
    }

    res.status(200).json({
      success: true,
      data: blog
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create new blog (admin)
 * POST /api/admin/blogs
 */
export const createBlog = async (req, res, next) => {
  try {
    // Get uploaded cover image from Cloudinary middleware (if file was uploaded)
    const uploadedCover = req.uploadedBlogCover || null
    
    // Get blog data from body
    const {
      title,
      excerpt,
      content,
      category,
      coverImageUrl,
      author,
      status = 'draft'
    } = req.body

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
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

    if (!category || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
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

    const { db } = await connectToDatabase()
    const collection = db.collection('blogs')

    // Generate slug from title
    let blogSlug = generateSlug(title)

    // Ensure slug is unique
    let slugExists = await collection.findOne({ slug: blogSlug })
    let slugCounter = 1
    const originalSlug = blogSlug
    while (slugExists) {
      blogSlug = `${originalSlug}-${slugCounter}`
      slugExists = await collection.findOne({ slug: blogSlug })
      slugCounter++
    }

    // Prepare blog data
    const blogData = {
      title: title.trim(),
      slug: blogSlug,
      excerpt: excerpt.trim(),
      content: content.trim(),
      category: category.trim(),
      coverImage,
      status: status === 'published' ? 'published' : 'draft',
      author: author && author.trim() ? author.trim() : 'Admin',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(blogData)

    res.status(201).json({
      success: true,
      message: 'Blog created successfully',
      data: {
        _id: result.insertedId,
        ...blogData
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update blog (admin)
 * PUT /api/admin/blogs/:id
 */
export const updateBlog = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Get uploaded cover image from Cloudinary middleware (if file was uploaded)
    const uploadedCover = req.uploadedBlogCover
    
    // Get blog data from body
    const {
      title,
      excerpt,
      content,
      category,
      coverImageUrl,
      author,
      status,
      deletedCoverImage = false
    } = req.body

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      })
    }

    // Validation
    if (title && !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty'
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
    const collection = db.collection('blogs')

    // Check if blog exists
    const existingBlog = await collection.findOne({ _id: new ObjectId(id) })
    if (!existingBlog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      })
    }

    // Build update object
    const updateData = {
      updatedAt: new Date()
    }

    if (title) updateData.title = title.trim()
    if (excerpt) updateData.excerpt = excerpt.trim()
    if (content) updateData.content = content.trim()
    if (category) updateData.category = category.trim()
    if (author !== undefined) updateData.author = author && author.trim() ? author.trim() : 'Admin'
    if (status !== undefined) updateData.status = status === 'published' ? 'published' : 'draft'

    // Handle slug update if title changed
    if (title && title.trim() !== existingBlog.title) {
      let blogSlug = generateSlug(title.trim())
      
      // Check if slug is unique (excluding current blog)
      if (blogSlug !== existingBlog.slug) {
        let slugExists = await collection.findOne({ 
          slug: blogSlug,
          _id: { $ne: new ObjectId(id) }
        })
        let slugCounter = 1
        const originalSlug = blogSlug
        while (slugExists) {
          blogSlug = `${originalSlug}-${slugCounter}`
          slugExists = await collection.findOne({ 
            slug: blogSlug,
            _id: { $ne: new ObjectId(id) }
          })
          slugCounter++
        }
        updateData.slug = blogSlug
      }
    }

    // Handle cover image
    if (uploadedCover) {
      // New file uploaded - delete old Cloudinary image if exists
      if (existingBlog.coverImage && existingBlog.coverImage.source === 'cloudinary') {
        try {
          await deleteImageFromCloudinary(existingBlog.coverImage.url)
        } catch (error) {
          console.error('Error deleting old cover image (non-critical):', error)
        }
      }
      updateData.coverImage = uploadedCover
    } else if (coverImageUrl !== undefined) {
      // URL provided or cover image deleted
      if (deletedCoverImage) {
        // Delete old Cloudinary image if exists
        if (existingBlog.coverImage && existingBlog.coverImage.source === 'cloudinary') {
          try {
            await deleteImageFromCloudinary(existingBlog.coverImage.url)
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
        if (existingBlog.coverImage && existingBlog.coverImage.source === 'cloudinary') {
          try {
            await deleteImageFromCloudinary(existingBlog.coverImage.url)
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
        updateData.coverImage = existingBlog.coverImage
      }
    }

    // Update blog
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      })
    }

    // Fetch updated blog
    const updatedBlog = await collection.findOne({ _id: new ObjectId(id) })

    res.status(200).json({
      success: true,
      message: 'Blog updated successfully',
      data: updatedBlog
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete blog (admin)
 * DELETE /api/admin/blogs/:id
 * Also deletes cover image from Cloudinary if source is cloudinary
 */
export const deleteBlog = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('blogs')

    // Get blog first to delete cover image from Cloudinary
    const blog = await collection.findOne({ _id: new ObjectId(id) })
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      })
    }

    // Delete cover image from Cloudinary if source is cloudinary
    if (blog.coverImage && blog.coverImage.source === 'cloudinary') {
      try {
        await deleteImageFromCloudinary(blog.coverImage.url)
      } catch (error) {
        console.error('Error deleting cover image from Cloudinary (non-critical):', error)
      }
    }

    // Delete blog from database
    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      })
    }

    res.status(200).json({
      success: true,
      message: 'Blog deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Publish blog (admin)
 * PATCH /api/admin/blogs/:id/publish
 */
export const publishBlog = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('blogs')

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
        message: 'Blog not found'
      })
    }

    const updatedBlog = await collection.findOne({ _id: new ObjectId(id) })

    res.status(200).json({
      success: true,
      message: 'Blog published successfully',
      data: updatedBlog
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Unpublish blog (admin)
 * PATCH /api/admin/blogs/:id/unpublish
 */
export const unpublishBlog = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('blogs')

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
        message: 'Blog not found'
      })
    }

    const updatedBlog = await collection.findOne({ _id: new ObjectId(id) })

    res.status(200).json({
      success: true,
      message: 'Blog unpublished successfully',
      data: updatedBlog
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get all published blogs (public)
 * GET /api/blogs
 */
export const getPublishedBlogs = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category = '',
      sort = 'createdAt',
      order = 'desc'
    } = req.query

    const { db } = await connectToDatabase()
    const collection = db.collection('blogs')

    // Build query - ONLY published blogs
    const query = { status: 'published' }
    
    // Category filter
    if (category && category.trim()) {
      query.category = category.trim()
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

    // Get blogs
    const blogs = await collection
      .find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .toArray()

    res.status(200).json({
      success: true,
      data: {
        data: blogs,
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
 * Get blog by slug (public)
 * GET /api/blogs/:slug
 */
export const getBlogBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params

    if (!slug || !slug.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Slug is required'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('blogs')

    // Find blog by slug - MUST be published
    const blog = await collection.findOne({ 
      slug: slug.trim(),
      status: 'published'
    })

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found or not published'
      })
    }

    res.status(200).json({
      success: true,
      data: blog
    })
  } catch (error) {
    next(error)
  }
}
