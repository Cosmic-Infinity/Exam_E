# Step 1: Use a lightweight Node image
FROM node:18-alpine

# Step 2: Set the working directory
WORKDIR /app

# Step 3: Copy package files first (The Wildcard Fix)
# This prevents the "not found" error for package-lock.json
COPY package*.json ./

# Step 4: Install dependencies
# Using 'npm install' or 'npm ci' if the lockfile exists
RUN npm install

# Step 5: Copy the rest of your frontend code
COPY . .

# Step 6: Expose the port the dev server runs on
EXPOSE 3000

# Step 7: Start the application
CMD ["npm", "start"]
