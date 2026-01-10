import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'

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
 * Get all projects (admin) - includes drafts
 * GET /api/admin/projects
 */
export const getAdminProjects = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 25, 
      q = '', 
      status = '', 
      tag = '',
      sort = 'createdAt',
      order = 'desc'
    } = req.query

    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

    // Build query
    const query = {}

    // Search query (title, description)
    if (q && q.trim()) {
      query.$or = [
        { title: { $regex: q.trim(), $options: 'i' } },
        { description: { $regex: q.trim(), $options: 'i' } }
      ]
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status
    }

    // Tag filter
    if (tag && tag.trim()) {
      query.tag = tag.trim()
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

    // Fetch projects
    const projects = await collection
      .find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .toArray()

    // Get unique tags for filter dropdown
    let tags = []
    try {
      const tagAggregation = await collection.aggregate([
        { $match: { tag: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$tag' } },
        { $sort: { _id: 1 } }
      ]).toArray()
      tags = tagAggregation.map(item => item._id).filter(Boolean).sort()
    } catch (aggError) {
      console.error('Error fetching tags:', aggError)
      tags = []
    }

    res.status(200).json({
      success: true,
      data: {
        data: projects || [],
        pagination: {
          total: total || 0,
          page: pageNum || 1,
          limit: limitNum || 25,
          totalPages: Math.ceil((total || 0) / (limitNum || 25))
        },
        filters: {
          tags: tags || []
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get single project by ID (admin)
 * GET /api/admin/projects/:id
 */
export const getAdminProjectById = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

    const project = await collection.findOne({ _id: new ObjectId(id) })

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      })
    }

    res.status(200).json({
      success: true,
      data: project
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create new project (admin)
 * POST /api/admin/projects
 */
export const createProject = async (req, res, next) => {
  try {
    const {
      title,
      slug,
      tag,
      year,
      category,
      description,
      coverImage,
      images = [],
      plans = [],
      info = {},
      status = 'draft'
    } = req.body

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      })
    }

    if (!tag || !['Residential', 'Commercial'].includes(tag)) {
      return res.status(400).json({
        success: false,
        message: 'Tag must be either "Residential" or "Commercial"'
      })
    }

    // Residential projects cannot have plans
    if (tag === 'Residential' && plans && plans.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Residential projects cannot have plans'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

    // Generate slug if not provided
    let projectSlug = slug || generateSlug(title)

    // Ensure slug is unique
    let slugExists = await collection.findOne({ slug: projectSlug })
    let slugCounter = 1
    const originalSlug = projectSlug
    while (slugExists) {
      projectSlug = `${originalSlug}-${slugCounter}`
      slugExists = await collection.findOne({ slug: projectSlug })
      slugCounter++
    }

    // Prepare project data
    const projectData = {
      title: title.trim(),
      slug: projectSlug,
      tag,
      year: year || null,
      category: category || null,
      description: description || '',
      coverImage: coverImage || null,
      images: Array.isArray(images) ? images : [],
      plans: tag === 'Residential' ? [] : (Array.isArray(plans) ? plans : []),
      info: {
        maitreDouverage: info.maitreDouverage || '',
        maitreDoeuvre: info.maitreDoeuvre || '',
        ingenieurs: info.ingenieurs || '',
        surface: info.surface || '',
        programme: info.programme || '',
        budget: info.budget || '',
        statut: info.statut || '',
        fullDescription: info.fullDescription || ''
      },
      status: status === 'published' ? 'published' : 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await collection.insertOne(projectData)

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: {
        _id: result.insertedId,
        ...projectData
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update project (admin)
 * PUT /api/admin/projects/:id
 */
export const updateProject = async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      title,
      slug,
      tag,
      year,
      category,
      description,
      coverImage,
      images = [],
      plans = [],
      info = {},
      status
    } = req.body

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      })
    }

    // Validation
    if (title && !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty'
      })
    }

    if (tag && !['Residential', 'Commercial'].includes(tag)) {
      return res.status(400).json({
        success: false,
        message: 'Tag must be either "Residential" or "Commercial"'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

    // Check if project exists
    const existingProject = await collection.findOne({ _id: new ObjectId(id) })
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      })
    }

    // Determine final tag (use existing if not provided)
    const finalTag = tag || existingProject.tag

    // Residential projects cannot have plans
    if (finalTag === 'Residential' && plans && plans.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Residential projects cannot have plans'
      })
    }

    // Build update object
    const updateData = {
      updatedAt: new Date()
    }

    if (title) updateData.title = title.trim()
    if (tag) updateData.tag = tag
    if (year !== undefined) updateData.year = year
    if (category !== undefined) updateData.category = category
    if (description !== undefined) updateData.description = description
    if (coverImage !== undefined) updateData.coverImage = coverImage
    if (images !== undefined) updateData.images = Array.isArray(images) ? images : []
    if (info !== undefined) {
      updateData.info = {
        maitreDouverage: info.maitreDouverage || existingProject.info?.maitreDouverage || '',
        maitreDoeuvre: info.maitreDoeuvre || existingProject.info?.maitreDoeuvre || '',
        ingenieurs: info.ingenieurs || existingProject.info?.ingenieurs || '',
        surface: info.surface || existingProject.info?.surface || '',
        programme: info.programme || existingProject.info?.programme || '',
        budget: info.budget || existingProject.info?.budget || '',
        statut: info.statut || existingProject.info?.statut || '',
        fullDescription: info.fullDescription || existingProject.info?.fullDescription || ''
      }
    }
    if (status !== undefined) updateData.status = status === 'published' ? 'published' : 'draft'

    // Handle slug
    if (slug || title) {
      let projectSlug = slug
      if (!projectSlug && title) {
        projectSlug = generateSlug(title)
      }

      // Check if slug is unique (excluding current project)
      if (projectSlug && projectSlug !== existingProject.slug) {
        let slugExists = await collection.findOne({ 
          slug: projectSlug,
          _id: { $ne: new ObjectId(id) }
        })
        let slugCounter = 1
        const originalSlug = projectSlug
        while (slugExists) {
          projectSlug = `${originalSlug}-${slugCounter}`
          slugExists = await collection.findOne({ 
            slug: projectSlug,
            _id: { $ne: new ObjectId(id) }
          })
          slugCounter++
        }
        updateData.slug = projectSlug
      }
    }

    // Handle plans based on tag - Residential cannot have plans, others can
    if (finalTag === 'Residential') {
      // Residential projects: always empty plans
      updateData.plans = []
    } else {
      // Other project types (Commercial, etc.) can have plans
      updateData.plans = Array.isArray(plans) ? plans : []
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      })
    }

    // Fetch updated project
    const updatedProject = await collection.findOne({ _id: new ObjectId(id) })

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete project (admin)
 * DELETE /api/admin/projects/:id
 */
export const deleteProject = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      })
    }

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Publish project (admin)
 * PATCH /api/admin/projects/:id/publish
 */
export const publishProject = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

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
        message: 'Project not found'
      })
    }

    const updatedProject = await collection.findOne({ _id: new ObjectId(id) })

    res.status(200).json({
      success: true,
      message: 'Project published successfully',
      data: updatedProject
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Unpublish project (admin)
 * PATCH /api/admin/projects/:id/unpublish
 */
export const unpublishProject = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

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
        message: 'Project not found'
      })
    }

    const updatedProject = await collection.findOne({ _id: new ObjectId(id) })

    res.status(200).json({
      success: true,
      message: 'Project unpublished successfully',
      data: updatedProject
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get all published projects (public)
 * GET /api/projects
 */
export const getPublishedProjects = async (req, res, next) => {
  try {
    const { tag, sort = 'createdAt', order = 'desc' } = req.query

    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

    // Build query - only published projects
    const query = { status: 'published' }

    // Tag filter
    if (tag && tag.trim()) {
      query.tag = tag.trim()
    }

    // Sort
    const sortOrder = order === 'asc' ? 1 : -1
    const sortObj = { [sort]: sortOrder }

    // Fetch projects
    const projects = await collection
      .find(query)
      .sort(sortObj)
      .toArray()

    res.status(200).json({
      success: true,
      data: projects || []
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get single project by slug (public)
 * GET /api/projects/:slug
 */
export const getProjectBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params

    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

    const project = await collection.findOne({ 
      slug: slug,
      status: 'published'
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      })
    }

    res.status(200).json({
      success: true,
      data: project
    })
  } catch (error) {
    next(error)
  }
}
