# Backend Setup Instructions

## Quick Start

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Create .env File**
   
   Copy the example environment file and fill in your values:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` with your actual configuration:
   ```env
   # MongoDB Connection
   MONGODB_URI=your_mongodb_connection_string
   
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # CORS Configuration
   FRONTEND_URL=http://localhost:3000
   ```

3. **Start the Server**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:5000`

## Important Notes

- Make sure MongoDB connection string is correct
- Update `FRONTEND_URL` if your frontend runs on a different port
- For production, set `NODE_ENV=production`
- Never commit `.env` file to version control

