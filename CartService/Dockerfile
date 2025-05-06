FROM node:18-alpine
WORKDIR /app

# First copy only package.json files to leverage Docker cache
COPY CartService/package*.json ./
COPY shared /app/shared

# Install dependencies
RUN npm install
RUN cd /app/shared && npm install

# Copy service code
COPY CartService /app

# Expose service port
EXPOSE 3003
CMD ["node", "server.js"]
