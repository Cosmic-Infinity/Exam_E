# Step 1: Use a lightweight Node image (Node 22 LTS)
FROM node:22-alpine

# Step 2: Set the working directory
WORKDIR /app

# Step 3: Copy package files
COPY package*.json ./

# Step 4: Install dependencies with legacy peer deps flag for compatibility
RUN npm install --legacy-peer-deps

# Step 5: Copy the rest of your frontend code
COPY . .

# Step 6: Expose the port the dev server runs on
EXPOSE 8080

# Step 7: Start the development server
CMD ["npm", "run", "dev"]
