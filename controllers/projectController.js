import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'
import { deleteImageFromCloudinary, extractPublicIdFromUrl } from '../middleware/upload.js'

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
 * Helper to parse JSON string or return array (for FormData fields)
 */
function parseArrayField(field) {
  if (!field) return []
  if (Array.isArray(field)) {
    // If it's an array, each element might be a JSON string - parse if needed
    const result = []
    field.forEach(item => {
      if (typeof item === 'string') {
        try {
          const parsed = JSON.parse(item)
          if (Array.isArray(parsed)) {
            result.push(...parsed)
          } else {
            result.push(parsed)
          }
        } catch {
          result.push(item) // Not JSON, treat as URL string
        }
      } else {
        result.push(item)
      }
    })
    return result.filter(Boolean)
  }
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return [field] // Single URL as string
    }
  }
  return []
}

/**
 * Helper to parse object from FormData
 */
function parseInfoObject(infoField) {
  if (!infoField) return {}
  if (typeof infoField === 'object') return infoField
  if (typeof infoField === 'string') {
    try {
      return JSON.parse(infoField)
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Helper to build info object from FormData fields (dot notation)
 */
function buildInfoFromFormData(reqBody, existingInfo = {}) {
  if (reqBody['info.maitreDouverage'] !== undefined) {
    return {
      maitreDouverage: reqBody['info.maitreDouverage'] || existingInfo.maitreDouverage || '',
      maitreDoeuvre: reqBody['info.maitreDoeuvre'] || existingInfo.maitreDoeuvre || '',
      ingenieurs: reqBody['info.ingenieurs'] || existingInfo.ingenieurs || '',
      surface: reqBody['info.surface'] || existingInfo.surface || '',
      programme: reqBody['info.programme'] || existingInfo.programme || '',
      budget: reqBody['info.budget'] || existingInfo.budget || '',
      statut: reqBody['info.statut'] || existingInfo.statut || '',
      fullDescription: reqBody['info.fullDescription'] || existingInfo.fullDescription || ''
    }
  }
  return existingInfo
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
    // Get uploaded images from Cloudinary middleware (if files were uploaded)
    const uploadedImages = req.uploadedProjectImages || {}
    
    // Get image data from body
    // Note: files are in req.files and handled by middleware, URLs are in req.body
    let {
      title,
      slug,
      tag,
      year,
      category,
      description,
      coverImage: coverImageUrl,
      imagesUrls, // URLs sent as separate field to avoid conflict with files
      plansUrls, // URLs sent as separate field to avoid conflict with files
      info,
      status = 'draft'
    } = req.body
    
    // Parse arrays (they may be JSON strings from FormData)
    imagesUrls = parseArrayField(imagesUrls)
    plansUrls = parseArrayField(plansUrls)
    info = parseInfoObject(info)
    
    // Handle info object if sent as individual fields (FormData with dot notation)
    info = buildInfoFromFormData(req.body, info)

    // Combine uploaded Cloudinary URLs with manual URLs
    // Priority: uploaded files > manual URLs
    const coverImage = uploadedImages.coverImage || coverImageUrl || null
    const images = [
      ...(uploadedImages.images || []),
      ...(Array.isArray(imagesUrls) ? imagesUrls : [])
    ].filter(Boolean)
    const plans = [
      ...(uploadedImages.plans || []),
      ...(Array.isArray(plansUrls) ? plansUrls : [])
    ].filter(Boolean)

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
      coverImage: coverImage,
      images: images,
      plans: tag === 'Residential' ? [] : plans,
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
    
    // Get uploaded images from Cloudinary middleware (if files were uploaded)
    const uploadedImages = req.uploadedProjectImages || {}
    
    // Helper to parse JSON string or return array
    const parseArrayField = (field) => {
      if (!field) return []
      if (Array.isArray(field)) return field
      if (typeof field === 'string') {
        try {
          const parsed = JSON.parse(field)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return [field] // Single URL as string
        }
      }
      return []
    }
    
    // Helper to parse object from FormData
    const parseInfoObject = (infoField) => {
      if (!infoField) return {}
      if (typeof infoField === 'object') return infoField
      if (typeof infoField === 'string') {
        try {
          return JSON.parse(infoField)
        } catch {
          return {}
        }
      }
      return {}
    }
    
    // Get image data from body
    // Note: files are in req.files and handled by middleware, URLs are in req.body
    let {
      title,
      slug,
      tag,
      year,
      category,
      description,
      coverImage: coverImageUrl,
      imagesUrls, // URLs sent as separate field to avoid conflict with files
      plansUrls, // URLs sent as separate field to avoid conflict with files
      deletedImages,
      deletedPlans,
      deletedCoverImage,
      info,
      status
    } = req.body
    
    // Parse arrays and objects (they may be JSON strings from FormData)
    imagesUrls = parseArrayField(imagesUrls)
    plansUrls = parseArrayField(plansUrls)
    deletedImages = parseArrayField(deletedImages)
    deletedPlans = parseArrayField(deletedPlans)
    deletedCoverImage = deletedCoverImage === 'true' || deletedCoverImage === true
    info = parseInfoObject(info)
    
    // Handle info object if sent as individual fields (FormData with dot notation)
    info = buildInfoFromFormData(req.body, info)

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

    // Delete images from Cloudinary if they were removed
    const deletePromises = []
    
    // Delete cover image if removed
    if (deletedCoverImage && existingProject.coverImage) {
      deletePromises.push(deleteImageFromCloudinary(existingProject.coverImage))
    }
    
    // Delete removed gallery images
    if (Array.isArray(deletedImages) && deletedImages.length > 0) {
      deletedImages.forEach(url => {
        if (url && typeof url === 'string') {
          deletePromises.push(deleteImageFromCloudinary(url))
        }
      })
    }
    
    // Delete removed plans (only for non-Residential projects)
    if (finalTag !== 'Residential' && Array.isArray(deletedPlans) && deletedPlans.length > 0) {
      deletedPlans.forEach(url => {
        if (url && typeof url === 'string') {
          deletePromises.push(deleteImageFromCloudinary(url))
        }
      })
    }
    
    // Wait for deletions to complete (don't fail if deletion fails)
    if (deletePromises.length > 0) {
      try {
        await Promise.allSettled(deletePromises)
      } catch (error) {
        console.error('Error deleting images from Cloudinary (non-critical):', error)
      }
    }

    // Combine existing images with new uploaded images and URLs
    // Filter out deleted images
    const existingImages = Array.isArray(existingProject.images) ? existingProject.images : []
    const existingPlans = Array.isArray(existingProject.plans) ? existingProject.plans : []
    
    const deletedImagesSet = new Set(Array.isArray(deletedImages) ? deletedImages : [])
    const deletedPlansSet = new Set(Array.isArray(deletedPlans) ? deletedPlans : [])
    
    const filteredExistingImages = existingImages.filter(url => !deletedImagesSet.has(url))
    const filteredExistingPlans = existingPlans.filter(url => !deletedPlansSet.has(url))
    
    // Combine: existing (filtered) + uploaded + new URLs
    const finalImages = [
      ...filteredExistingImages,
      ...(uploadedImages.images || []),
      ...(Array.isArray(imagesUrls) ? imagesUrls : [])
    ].filter(Boolean)
    
    const finalPlans = finalTag === 'Residential' ? [] : [
      ...filteredExistingPlans,
      ...(uploadedImages.plans || []),
      ...(Array.isArray(plansUrls) ? plansUrls : [])
    ].filter(Boolean)

    // Residential projects cannot have plans (double check)
    if (finalTag === 'Residential' && finalPlans.length > 0) {
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
    
    // Handle cover image: use uploaded, new URL, or keep existing (unless deleted)
    if (uploadedImages.coverImage) {
      updateData.coverImage = uploadedImages.coverImage
    } else if (coverImageUrl !== undefined) {
      updateData.coverImage = deletedCoverImage ? null : (coverImageUrl || existingProject.coverImage)
    } else if (deletedCoverImage) {
      updateData.coverImage = null
    }
    
    // Handle images: always update with final combined array
    if (imagesUrls !== undefined || uploadedImages.images) {
      updateData.images = finalImages
    }
    
    if (info !== undefined) {
      updateData.info = {
        maitreDouverage: info.maitreDouverage !== undefined ? (info.maitreDouverage || '') : (existingProject.info?.maitreDouverage || ''),
        maitreDoeuvre: info.maitreDoeuvre !== undefined ? (info.maitreDoeuvre || '') : (existingProject.info?.maitreDoeuvre || ''),
        ingenieurs: info.ingenieurs !== undefined ? (info.ingenieurs || '') : (existingProject.info?.ingenieurs || ''),
        surface: info.surface !== undefined ? (info.surface || '') : (existingProject.info?.surface || ''),
        programme: info.programme !== undefined ? (info.programme || '') : (existingProject.info?.programme || ''),
        budget: info.budget !== undefined ? (info.budget || '') : (existingProject.info?.budget || ''),
        statut: info.statut !== undefined ? (info.statut || '') : (existingProject.info?.statut || ''),
        fullDescription: info.fullDescription !== undefined ? (info.fullDescription || '') : (existingProject.info?.fullDescription || '')
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
      // Use final combined plans array
      if (plansUrls !== undefined || uploadedImages.plans) {
        updateData.plans = finalPlans
      }
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
 * Also deletes all associated images from Cloudinary
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

    // Get project first to delete images from Cloudinary
    const project = await collection.findOne({ _id: new ObjectId(id) })
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      })
    }

    // Delete all images from Cloudinary (non-blocking)
    const deletePromises = []
    
    if (project.coverImage) {
      deletePromises.push(deleteImageFromCloudinary(project.coverImage))
    }
    
    if (Array.isArray(project.images)) {
      project.images.forEach(url => {
        if (url) {
          deletePromises.push(deleteImageFromCloudinary(url))
        }
      })
    }
    
    if (Array.isArray(project.plans)) {
      project.plans.forEach(url => {
        if (url) {
          deletePromises.push(deleteImageFromCloudinary(url))
        }
      })
    }
    
    // Delete images from Cloudinary (don't fail if deletion fails)
    if (deletePromises.length > 0) {
      try {
        await Promise.allSettled(deletePromises)
      } catch (error) {
        console.error('Error deleting images from Cloudinary (non-critical):', error)
      }
    }

    // Delete project from database
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
 * Delete project image from Cloudinary (admin)
 * DELETE /api/admin/projects/:id/image
 * Query params: type=cover|gallery|plan, url={imageUrl}
 */
export const deleteProjectImage = async (req, res, next) => {
  try {
    const { id } = req.params
    const { type, url } = req.query

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      })
    }

    if (!type || !['cover', 'gallery', 'plan'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be cover, gallery, or plan'
      })
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      })
    }

    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

    // Get project
    const project = await collection.findOne({ _id: new ObjectId(id) })
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      })
    }

    // Delete image from Cloudinary
    const deleted = await deleteImageFromCloudinary(url)
    
    if (!deleted) {
      console.warn('Could not delete image from Cloudinary:', url)
      // Continue anyway - image might already be deleted or not be a Cloudinary URL
    }

    // Remove image from project in database
    const updateData = {}
    
    if (type === 'cover') {
      updateData.coverImage = null
    } else if (type === 'gallery') {
      const images = Array.isArray(project.images) ? project.images : []
      updateData.images = images.filter(img => img !== url)
    } else if (type === 'plan') {
      const plans = Array.isArray(project.plans) ? project.plans : []
      updateData.plans = plans.filter(plan => plan !== url)
    }

    updateData.updatedAt = new Date()

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    )

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
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
