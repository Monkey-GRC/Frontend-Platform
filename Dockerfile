FROM node:20-alpine AS build
WORKDIR /app
ARG API_URL=http://localhost:3000/v1

COPY package*.json ./
RUN npm ci

COPY . .
RUN sed -i "s#apiUrl: '.*'#apiUrl: '${API_URL}'#" src/app/config/environments/environment.ts
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
