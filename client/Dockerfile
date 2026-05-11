FROM node:20-alpine AS build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=https://phxfztxxlkyhvtidriqa.supabase.co
ENV VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoeGZ6dHh4bGt5aHZ0aWRyaXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTk4NzgsImV4cCI6MjA5MzQ3NTg3OH0.Qw7O1suhN6Le4iV-nI8Rjw4P618J6g5CDQmLk0izCyM
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
