# Stage 1: Build Angular app
FROM node:22-alpine AS build

RUN apk upgrade --no-cache

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npx ng build --configuration=production

# Stage 2: Serve with nginx
FROM nginx:stable-alpine

# gettext provides envsubst for substituting ${DOMAIN} in nginx.conf at startup
RUN apk add --no-cache gettext

COPY nginx.conf /etc/nginx/nginx.conf.template

COPY --from=build /app/dist/gams-frontend /usr/share/nginx/html

EXPOSE 80 443

# Substitute environment variables and start nginx
CMD ["/bin/sh", "-c", "envsubst '${DOMAIN} ${ADMIN_IP_RANGE} ${PMA_SECRET_PATH}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
