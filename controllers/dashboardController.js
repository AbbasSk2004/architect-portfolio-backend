import { connectToDatabase } from '../config/database.js'
import Stripe from 'stripe'
import dotenv from 'dotenv'

dotenv.config()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
})

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    const { db } = await connectToDatabase()
    
    // Get counts from all collections
    const [
      projectsCount,
      testimonialsCount,
      inquiriesCount,
      paidBookingsCount,
      blogPostsCount,
      newsPostsCount,
      careerApplicationsCount
    ] = await Promise.all([
      db.collection('projects').countDocuments({}),
      db.collection('testimonials').countDocuments({}),
      db.collection('inquiries').countDocuments({}),
      db.collection('inquiries').countDocuments({ paymentStatus: 'paid' }),
      db.collection('blogs').countDocuments({}),
      db.collection('news').countDocuments({}),
      db.collection('career_applications').countDocuments({})
    ])
    
    // Get recent inquiries (latest 5)
    const recentInquiries = await db.collection('inquiries')
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray()
    
    // Get recent bookings (latest 5 paid inquiries)
    const recentBookings = await db.collection('inquiries')
      .find({ paymentStatus: 'paid' })
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(5)
      .toArray()
    
    // Calculate total revenue from Stripe
    let totalRevenue = 0
    let lastPaymentStatus = null
    let lastPaymentDate = null
    
    try {
      // Get all paid inquiries with Stripe session IDs
      const paidInquiries = await db.collection('inquiries')
        .find({ 
          paymentStatus: 'paid',
          stripeSessionId: { $exists: true, $ne: null }
        })
        .sort({ paidAt: -1 })
        .toArray()
      
      if (paidInquiries.length > 0) {
        // Get the latest payment session
        const latestInquiry = paidInquiries[0]
        if (latestInquiry.stripeSessionId) {
          try {
            const session = await stripe.checkout.sessions.retrieve(latestInquiry.stripeSessionId)
            lastPaymentStatus = session.payment_status
            lastPaymentDate = latestInquiry.paidAt || latestInquiry.updatedAt
            
            // Calculate total revenue from all paid sessions
            for (const inquiry of paidInquiries) {
              if (inquiry.stripeSessionId) {
                try {
                  const session = await stripe.checkout.sessions.retrieve(inquiry.stripeSessionId)
                  if (session.amount_total) {
                    totalRevenue += session.amount_total / 100 // Convert from cents to euros
                  }
                } catch (err) {
                  console.error(`Error fetching session ${inquiry.stripeSessionId}:`, err.message)
                }
              }
            }
          } catch (err) {
            console.error('Error fetching latest Stripe session:', err.message)
          }
        }
      }
    } catch (error) {
      console.error('Error calculating revenue:', error.message)
    }
    
    res.status(200).json({
      success: true,
      data: {
        counts: {
          projects: projectsCount,
          testimonials: testimonialsCount,
          inquiries: inquiriesCount,
          paidBookings: paidBookingsCount,
          blogPosts: blogPostsCount,
          newsPosts: newsPostsCount,
          careerApplications: careerApplicationsCount
        },
        recentActivity: {
          inquiries: recentInquiries.map(inquiry => ({
            _id: inquiry._id,
            firstName: inquiry.firstName,
            lastName: inquiry.lastName,
            email: inquiry.email,
            status: inquiry.status,
            paymentStatus: inquiry.paymentStatus,
            createdAt: inquiry.createdAt
          })),
          bookings: recentBookings.map(booking => ({
            _id: booking._id,
            firstName: booking.firstName,
            lastName: booking.lastName,
            email: booking.email,
            // Amount is stored in Stripe session, not in billingInfo
            // Calculate from consultation details if needed, or fetch from Stripe
            amount: null, // Amount should be retrieved from Stripe session if needed
            paidAt: booking.paidAt || booking.updatedAt,
            createdAt: booking.createdAt
          }))
        },
        stripe: {
          totalRevenue: totalRevenue,
          lastPaymentStatus: lastPaymentStatus,
          lastPaymentDate: lastPaymentDate
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

