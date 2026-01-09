import Stripe from 'stripe'
import dotenv from 'dotenv'
import { connectToDatabase } from '../config/database.js'
import { ObjectId } from 'mongodb'

dotenv.config()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
})

/**
 * Submit business billing information (post-payment)
 * This endpoint finalizes invoices after collecting business billing details
 * POST /api/billing/business
 */
export const submitBusinessBilling = async (req, res, next) => {
  try {
    const { inquiryId, customerId, invoiceId, companyName, address, vatNumber } = req.body

    // Validate required fields
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      })
    }

    if (!address || !address.line1 || !address.city || !address.postalCode) {
      return res.status(400).json({
        success: false,
        message: 'Complete billing address is required (line1, city, postalCode)'
      })
    }

    // Require Stripe customer and invoice IDs
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Stripe customer ID is required'
      })
    }

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: 'Stripe invoice ID is required'
      })
    }

    const { db } = await connectToDatabase()

    // If inquiryId is provided, validate and update inquiry
    let inquiry = null
    if (inquiryId && ObjectId.isValid(inquiryId)) {
      inquiry = await db.collection('inquiries').findOne({
        _id: new ObjectId(inquiryId)
      })

      if (!inquiry) {
        return res.status(404).json({
          success: false,
          message: 'Inquiry not found'
        })
      }

      // Verify customer and invoice IDs match inquiry
      if (inquiry.stripeCustomerId && inquiry.stripeCustomerId !== customerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID mismatch'
        })
      }

      if (inquiry.stripeInvoiceId && inquiry.stripeInvoiceId !== invoiceId) {
        return res.status(400).json({
          success: false,
          message: 'Invoice ID mismatch'
        })
      }
    }

    // Update Stripe customer with company name and address
    await stripe.customers.update(customerId, {
      name: companyName.trim(),
      address: {
        line1: address.line1.trim(),
        line2: address.line2?.trim() || undefined,
        city: address.city.trim(),
        postal_code: address.postalCode.trim(),
        country: address.country || 'FR'
      }
    })

    console.log('✅ Stripe customer updated:', {
      customerId: customerId,
      companyName: companyName.trim()
    })

    // Add tax ID if provided
    if (vatNumber && vatNumber.trim()) {
      try {
        await stripe.customers.createTaxId(customerId, {
          type: 'eu_vat',
          value: vatNumber.trim()
        })
        console.log('✅ Tax ID created:', {
          customerId: customerId,
          vatNumber: vatNumber.trim()
        })
      } catch (taxIdError) {
        // Log error but don't fail - VAT might be invalid format
        console.error('⚠️  Error creating tax ID (continuing anyway):', taxIdError.message)
        // Continue - invoice will still be finalized
      }
    }

    // Finalize the invoice
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId)
      
      if (invoice.status === 'draft') {
        // Finalize the invoice
        await stripe.invoices.finalizeInvoice(invoiceId)
        console.log('✅ Invoice finalized:', invoiceId)
      } else if (invoice.status === 'open' || invoice.status === 'paid') {
        console.log('ℹ️  Invoice already finalized:', {
          invoiceId: invoiceId,
          status: invoice.status
        })
      } else {
        console.warn('⚠️  Invoice in unexpected status:', {
          invoiceId: invoiceId,
          status: invoice.status
        })
      }
    } catch (invoiceError) {
      console.error('❌ Error finalizing invoice:', invoiceError)
      // Don't fail the request - customer is updated, invoice can be finalized manually
      return res.status(500).json({
        success: false,
        message: 'Customer updated but invoice finalization failed. Please contact support.',
        error: invoiceError.message
      })
    }

    // Update inquiry if provided
    if (inquiryId && ObjectId.isValid(inquiryId)) {
      await db.collection('inquiries').updateOne(
        { _id: new ObjectId(inquiryId) },
        {
          $set: {
            invoiceStatus: 'finalized',
            billingCollectedAt: new Date(),
            updatedAt: new Date()
          }
        }
      )
      console.log('✅ Inquiry updated with billing info:', inquiryId)
    }

    res.status(200).json({
      success: true,
      message: 'Billing information submitted and invoice finalized successfully',
      data: {
        customerId: customerId,
        invoiceId: invoiceId
      }
    })
  } catch (error) {
    console.error('❌ Error submitting business billing:', error)
    next(error)
  }
}
