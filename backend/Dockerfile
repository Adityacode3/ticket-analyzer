# Use official Node LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency files first (layer caching)
COPY package.json ./

# Install all dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Expose the backend port
EXPOSE 5000

# Start the server
CMD ["node", "src/server.js"]