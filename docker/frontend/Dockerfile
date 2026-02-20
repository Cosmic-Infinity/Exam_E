# Step 1: Use a lightweight Node image
FROM node:18-alpine

# Step 2: Set the working directory
WORKDIR /app

# Step 3: Copy package files
COPY package*.json ./

# Step 4: Install dependencies
RUN npm install

# Step 5: Copy the rest of your frontend code
COPY . .

# Step 6: Expose the port the dev server runs on
EXPOSE 3000

# Step 7: Start the development server
CMD ["npm", "run", "dev"]
