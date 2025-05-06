FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ARG VITE_BACKEND_URL=http://localhost:3001
ARG VITE_PRODUCT_SERVICE_URL=http://localhost:3002
ARG VITE_CART_SERVICE_URL=http://localhost:3003
ARG VITE_ORDER_SERVICE_URL=http://localhost:3004
ARG VITE_PAYMENT_SERVICE_URL=http://localhost:3005

ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_PRODUCT_SERVICE_URL=${VITE_PRODUCT_SERVICE_URL}
ENV VITE_CART_SERVICE_URL=${VITE_CART_SERVICE_URL}
ENV VITE_ORDER_SERVICE_URL=${VITE_ORDER_SERVICE_URL}
ENV VITE_PAYMENT_SERVICE_URL=${VITE_PAYMENT_SERVICE_URL}

RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Copy built files from build stage to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Add nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"] 