# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ---- Runtime stage (nginx) ----
FROM nginx:1.27-alpine AS runtime

# openssl is used by the edge-auth entrypoint to hash the Basic Auth password.
RUN apk add --no-cache openssl

# nginx:alpine auto-runs envsubst on *.template files into /etc/nginx/conf.d/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Edge auth: default to "off"; 40-edge-auth.sh rewrites this at start-up if
# EDGE_AUTH_USER / EDGE_AUTH_PASSWORD are set.
COPY docker-entrypoint.d/40-edge-auth.sh /docker-entrypoint.d/40-edge-auth.sh
RUN chmod +x /docker-entrypoint.d/40-edge-auth.sh \
    && printf 'auth_basic off;\n' > /etc/nginx/edge-auth.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
