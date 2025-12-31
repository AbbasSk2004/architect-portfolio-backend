# Backend API - Architect Portfolio

Express.js backend API for the Joseph Dibeh Architecture Portfolio website.

## Features

- ✅ Express.js server
- ✅ MongoDB integration with connection pooling
- ✅ RESTful API endpoints for testimonials
- ✅ CORS configuration
- ✅ Environment variable support
- ✅ Error handling middleware

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# MongoDB Connection
MONGODB_URI=your_mongodb_connection_string_here

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

**Note:** Copy `.env.example` to `.env` and fill in your actual values.

### 3. Run the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

## API Endpoints

### Health Check
- `GET /health` - Server health check

### Testimonials
- `GET /api/testimonials` - Get all testimonials
- `GET /api/testimonials/:id` - Get a single testimonial by ID
- `POST /api/testimonials` - Create a new testimonial
- `PUT /api/testimonials/:id` - Update a testimonial
- `DELETE /api/testimonials/:id` - Delete a testimonial

### Testimonial Schema

```json
{
  "_id": "ObjectId",
  "fullName": "string (required)",
  "phoneNumber": "string (optional)",
  "email": "string (required)",
  "projectType": "string (optional)",
  "review": "string (required)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## Project Structure

```
backend/
├── config/
│   └── database.js           # MongoDB connection configuration
├── controllers/
│   └── testimonialsController.js  # Testimonials business logic
├── middleware/
│   ├── errorHandler.js       # Global error handling middleware
│   ├── validation.js         # Request validation middleware
│   └── logger.js            # Request logging middleware
├── routes/
│   └── testimonials.js       # Testimonials API routes
├── server.js                 # Express server setup
├── package.json              # Dependencies
├── .env                      # Environment variables (not in git)
└── README.md                 # This file
```

### Architecture

- **Controllers**: Handle business logic and database operations
- **Routes**: Define API endpoints and connect them to controllers
- **Middleware**: Handle cross-cutting concerns (validation, error handling, logging)
- **Config**: Configuration files (database, etc.)

## Database

The backend connects to MongoDB Atlas. The database name is `architect_portfolio` and testimonials are stored in the `testimonials` collection.

## Error Handling

All API responses follow this format:

**Success:**
```json
{
  "success": true,
  "data": {...},
  "message": "Optional message"
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## Development

The server uses ES modules (`"type": "module"` in package.json), so all imports use the `import` syntax.

## Deployment

### Render.com Deployment

1. **Create a new Web Service** on Render
2. **Connect your GitHub repository**
3. **Configure Build Settings:**
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Add Environment Variables:**
   - `MONGODB_URI` - Your MongoDB Atlas connection string
   - `PORT` - Port (Render will set this automatically, but you can override)
   - `NODE_ENV` - Set to `production`
   - `FRONTEND_URL` - Your frontend URL (e.g., `https://your-frontend.onrender.com`)

5. **MongoDB Atlas Configuration:**
   - Ensure your MongoDB Atlas cluster allows connections from Render's IP ranges
   - Add `0.0.0.0/0` to Network Access for development, or specific IPs for production

### Environment Variables for Production

Make sure to set these in your deployment platform:
- `MONGODB_URI` - Required
- `NODE_ENV` - Set to `production`
- `FRONTEND_URL` - Your production frontend URL
- `PORT` - Usually set automatically by the platform

## API Response Format

All API responses follow a consistent format:

**Success:**
```json
{
  "success": true,
  "data": {...},
  "message": "Optional message"
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error message"
}
```

## Unique Constraints

- **Email**: Must be unique across all testimonials
- **Phone Number**: Must be unique across all testimonials (if provided)

These constraints are enforced both at the application level and database level (via MongoDB indexes).

