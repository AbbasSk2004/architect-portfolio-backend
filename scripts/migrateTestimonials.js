/**
 * Migration script to add status field to existing testimonials
 * Run this once to migrate existing testimonials to have status = "approved"
 * 
 * Usage: node scripts/migrateTestimonials.js
 */

import { connectToDatabase } from '../config/database.js'
import dotenv from 'dotenv'

dotenv.config()

async function migrateTestimonials() {
  try {
    console.log('🔄 Starting testimonials migration...')
    
    const { db } = await connectToDatabase()
    
    // Find all testimonials without status field
    const testimonialsWithoutStatus = await db.collection('testimonials')
      .find({ status: { $exists: false } })
      .toArray()
    
    console.log(`📊 Found ${testimonialsWithoutStatus.length} testimonials without status field`)
    
    if (testimonialsWithoutStatus.length === 0) {
      console.log('✅ No testimonials need migration. All testimonials already have status field.')
      process.exit(0)
    }
    
    // Update all testimonials without status to have status = "approved"
    const result = await db.collection('testimonials').updateMany(
      { status: { $exists: false } },
      {
        $set: {
          status: 'approved',
          updatedAt: new Date()
        }
      }
    )
    
    console.log(`✅ Migration complete!`)
    console.log(`   - Updated ${result.modifiedCount} testimonials`)
    console.log(`   - All existing testimonials now have status: "approved"`)
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migrateTestimonials()
