FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy function code
COPY . .

# Expose port
EXPOSE 8080

# Start the function
CMD ["npm", "start"]