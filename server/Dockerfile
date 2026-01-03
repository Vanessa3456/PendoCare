# Use official Node.js lightweight image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage cache
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define environment variables (optional default, can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["npm", "start"]
