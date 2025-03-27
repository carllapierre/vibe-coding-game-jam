FROM node:16

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 2567

# Use an entrypoint script to conditionally run the right command based on NODE_ENV
CMD if [ "$NODE_ENV" = "production" ]; then \
      node build/index.js; \
    else \
      npm start; \
    fi 