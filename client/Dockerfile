FROM node:20-alpine AS build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
# Build from repo root so the monorepo workspace resolves correctly and
# vite.config outDir "../dist\" lands at /app/dist (relative to /app/client).
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install --workspace client
COPY client ./client
WORKDIR /app/client
RUN npm run build

FROM nginx:alpine
# outDir is "../dist\" relative to /app/client, so built output is at /app/dist
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
