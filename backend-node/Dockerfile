FROM node:20-alpine

WORKDIR /app/backend-node

COPY backend-node/package*.json ./
RUN npm install

COPY backend-node ./

EXPOSE 4000
CMD ["npm", "start"]
