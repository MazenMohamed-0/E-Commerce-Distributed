FROM node:20-alpine

WORKDIR /app

# First copy only package.json files to leverage Docker cache
COPY EmailService/package*.json ./
COPY shared /app/shared

# Install dependencies
RUN npm install
RUN cd /app/shared && npm install

# Copy service code
COPY EmailService /app

ENV NODE_ENV=development
ENV PROJECT_ID=precise-valor-457221-a5

EXPOSE 8081

CMD ["npm", "run", "dev"] 