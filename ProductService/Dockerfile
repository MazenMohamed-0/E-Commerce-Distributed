FROM node:18-alpine

WORKDIR /app

# First copy only package.json files to leverage Docker cache
COPY ProductService/package*.json ./
COPY shared /app/shared

# Install dependencies
RUN npm install
RUN cd /app/shared && npm install

# Copy service code
COPY ProductService /app

EXPOSE 3002

CMD ["npm", "run", "dev"] 