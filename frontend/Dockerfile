# Use an official Node runtime as a parent image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# Install dependencies (if package.json exists, otherwise this layer does nothing initially)
COPY package.json ./
COPY package-lock.json ./
RUN npm install --silent

# Copy project files
COPY . ./

# Expose port and start
EXPOSE 3000
CMD ["npm", "start"]
