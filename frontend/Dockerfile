FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit

COPY . .

# Build production bundle using webpack
RUN npm run build

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
