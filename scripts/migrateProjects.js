/**
 * Migration script to add existing projects to MongoDB
 * Residential projects will be added WITHOUT plans (as per requirements)
 */

import { connectToDatabase } from '../config/database.js'
import dotenv from 'dotenv'

dotenv.config()

const existingProjects = [
  {
    title: 'Studio Lumière',
    tag: 'Residential',
    year: '2023',
    category: 'Residential • Saint-ouen-sur-seine',
    description: 'A sleek, light-filled apartment featuring neutral tones, minimalist lines, and warm accents for a serene, contemporary ambiance.',
    coverImage: 'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/4efbb069-6f57-4bb1-8dad-f1954e4b0a49_1600w.jpg',
    images: [
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/546c267c-5ac2-486e-83da-0dd8a59c52a1_3840w.jpg',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/51789beb-31cb-41c2-9b6c-7600d30d2a8c_3840w.jpg',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/a0b95773-4069-4b42-94cb-f02c76f98dc4_3840w.jpg',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/e9ffaf04-9242-4cf8-86db-ce738d33ca22_3840w.jpg',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/de8fc34c-ffab-4241-91db-3a8d861264c4_3840w.jpg',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/fdc9e846-dc16-45d1-af89-7b81a71b0868_3840w.jpg',
    ],
    plans: [], // Residential projects CANNOT have plans
    info: {
      maitreDouverage: 'Privé',
      maitreDoeuvre: 'Atela Architectes',
      ingenieurs: 'YAC ingénierie, LVC ingénierie',
      surface: '85 m²',
      programme: 'Rénovation complète d\'un appartement résidentiel avec réaménagement des espaces',
      budget: '420 000 € H.T',
      statut: 'Livré en 2023',
      fullDescription: 'Ce projet de rénovation résidentielle à Saint-Ouen-sur-Seine transforme un appartement existant en un espace lumineux et contemporain. L\'intervention se caractérise par une réorganisation spatiale optimisée, privilégiant la fluidité et la lumière naturelle. Les matériaux neutres et les lignes épurées créent une atmosphère sereine, tandis que les accents chaleureux apportent une dimension résidentielle authentique.',
    },
    status: 'published'
  },
  {
    title: 'La Loge De Coluche',
    tag: 'Residential',
    year: '2022',
    category: 'Residential • Paris 17',
    description: 'A warm and contemporary apartment blending terracotta tones, natural textures, and intimate lighting for an inviting, refined living experience.',
    coverImage: 'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/cb79467b-b1a8-45ea-b760-1bf09f43c6b2_1600w.jpg',
    images: [
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/cb79467b-b1a8-45ea-b760-1bf09f43c6b2_1600w.jpg',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/b7d691a5-878b-4404-bf4e-02398bcb2798_3840w.png',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/8fe2311b-5538-4470-950f-6c645e5481ef_3840w.png',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/48ecb7bc-bd61-4b9f-b190-171289481335_3840w.jpg',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/11c99d9d-c371-4028-839c-963146c86934_3840w.png',
    ],
    plans: [], // Residential projects CANNOT have plans
    info: {
      maitreDouverage: 'Privé',
      maitreDoeuvre: 'Atela Architectes',
      ingenieurs: 'YAC ingénierie, META',
      surface: '95 m²',
      programme: 'Rénovation d\'un appartement avec création d\'espaces intimes et chaleureux',
      budget: '380 000 € H.T',
      statut: 'Livré en 2022',
      fullDescription: 'La Loge De Coluche est un projet résidentiel situé dans le 17ème arrondissement de Paris. L\'intervention architecturale privilégie une palette de tons terreux, notamment le terracotta, qui dialogue avec des textures naturelles et un éclairage intime. L\'espace est conçu comme un cocon chaleureux où chaque détail contribue à créer une atmosphère résidentielle authentique et contemporaine.',
    },
    status: 'published'
  },
  {
    title: 'Le Speakeasy Paris',
    tag: 'Commercial',
    year: 'Proposal',
    category: 'Commercial • Paris 16',
    description: 'An opulent speakeasy design featuring rich red tones, dramatic lighting, and sophisticated dining spaces.',
    coverImage: 'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/1cd1a9f1-3e85-4343-bc9a-a00641d63bfa_1600w.jpg',
    images: [
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/fadaf903-364e-4535-8b38-5c076b200cc2_3840w.png',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/a284fabd-f886-4617-a374-dd06811c735d_3840w.png',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/ee4e270b-916e-4d51-9bf2-2c092429db8f_3840w.png',
    ],
    plans: [
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/546c267c-5ac2-486e-83da-0dd8a59c52a1_3840w.jpg',
      'https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/fdc9e846-dc16-45d1-af89-7b81a71b0868_3840w.jpg',
    ], // Commercial projects CAN have plans
    info: {
      maitreDouverage: 'Privé',
      maitreDoeuvre: 'Atela Architectes',
      ingenieurs: 'YAC ingénierie, LVC ingénierie, META',
      surface: '320 m²',
      programme: 'Création d\'un speakeasy avec espaces de restauration et bar',
      budget: '1.8 M € H.T',
      statut: 'Projet en cours',
      fullDescription: 'Le Speakeasy Paris est un projet commercial ambitieux situé dans le 16ème arrondissement. Le concept architectural s\'inspire des speakeasies historiques, créant une atmosphère opulente et sophistiquée. Les tons rouges profonds, l\'éclairage dramatique et les espaces de restauration raffinés définissent une expérience immersive. Le design privilégie l\'intimité et l\'élégance, créant des séquences spatiales qui guident les convives à travers différents ambiances.',
    },
    status: 'published'
  }
]

function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function migrateProjects() {
  try {
    console.log('🔄 Starting projects migration...')
    
    const { db } = await connectToDatabase()
    const collection = db.collection('projects')

    let inserted = 0
    let skipped = 0

    for (const project of existingProjects) {
      // Generate slug
      const slug = generateSlug(project.title)

      // Check if project with same slug already exists
      const existing = await collection.findOne({ slug })
      if (existing) {
        console.log(`⏭️  Skipping "${project.title}" - already exists`)
        skipped++
        continue
      }

      // Prepare project data
      const projectData = {
        ...project,
        slug,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Insert project
      await collection.insertOne(projectData)
      console.log(`✅ Inserted "${project.title}" (${project.tag})`)
      inserted++
    }

    console.log(`\n✨ Migration complete!`)
    console.log(`   Inserted: ${inserted}`)
    console.log(`   Skipped: ${skipped}`)
    console.log(`   Total: ${existingProjects.length}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migrateProjects()
