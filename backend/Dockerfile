FROM node:20-alpine

# Install OpenSSL required by Prisma schema engine on Alpine Linux (musl/OpenSSL 3.x)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy backend deps first for layer cache
COPY backend/package*.json ./

RUN npm install

# Copy backend source
COPY backend/ ./

# Copy prisma schema from project root (build context = project root)
COPY prisma/ ./prisma/

# Generate Prisma client from schema
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
