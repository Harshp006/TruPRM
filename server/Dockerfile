FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm i --package-lock-only
RUN npm ci

COPY . .
RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "run", "dev"]
