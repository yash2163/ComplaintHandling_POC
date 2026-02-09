FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (not needed for Cloud Run but good practice)
EXPOSE 8080

# Run worker
CMD ["npm", "run", "start:worker"]
