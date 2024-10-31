# Use a Node.js base image
FROM node:20

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY . .
RUN npm install
RUN npm run build

# Expose port (change if needed)
EXPOSE 8989

# Run the app
CMD ["node", "chaptertool.js", "serve"]