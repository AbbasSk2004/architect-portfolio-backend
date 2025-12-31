/**
 * Request logging middleware
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now()
  
  // Log request
  console.log(`${req.method} ${req.originalUrl} - ${new Date().toISOString()}`)
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(
      `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`
    )
  })
  
  next()
}

