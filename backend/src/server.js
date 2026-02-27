// src/server.js
// Entry point — boots the HTTP server after DB connection is confirmed

'use strict';

const mongoose = require('mongoose');
const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/support_triage';

/**
 * Connect to MongoDB, then start Express server.
 * Keeping these sequential ensures the app never
 * accepts traffic before the DB is ready.
 */
async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected: ${MONGO_URI}`);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1); // Exit with failure so Docker can restart the container
  }
}

startServer();