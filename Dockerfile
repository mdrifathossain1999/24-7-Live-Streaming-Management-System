# Production Docker Build
FROM node:20-slim

# Install system dependencies (FFmpeg is required for video loops and RTMP uploads)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy dependency configs
COPY package*.json ./

# Install packages
RUN npm install

# Copy application source
COPY . .

# Build React client static files and Node server bundles
RUN npm run build

# Setup permanent volume directories for video and logo uploads
RUN mkdir -p uploads/videos uploads/logos

# Expose control panel interface ingress port
EXPOSE 3000

# Start production server
CMD ["npm", "start"]
