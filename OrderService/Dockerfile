FROM node:18-alpine

WORKDIR /app

# First copy only package.json files to leverage Docker cache
COPY OrderService/package*.json ./
COPY shared /app/shared

# Install dependencies
RUN npm install
RUN cd /app/shared && npm install

# Copy service code
COPY OrderService /app

ENV EMAIL_SERVICE_URL=https://us-central1-precise-valor-457221-a5.cloudfunctions.net/sendOrderConfirmation

EXPOSE 3004

CMD ["npm", "run", "dev"] 