#!/bin/bash
set -e

if ! command -v docker &> /dev/null; then
  echo "Docker is not installed. Please install Docker."
  exit 1
fi
if ! command -v docker-compose &> /dev/null; then
  echo "Docker Compose is not installed. Please install Docker Compose."
  exit 1
fi

cp backend/.env.example backend/.env.development || true
cp frontend/.env.development frontend/.env.local || true

echo "Starting local development environment..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

echo "Running migrations..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec backend npx sequelize db:migrate

echo "Setup complete. Access frontend at http://localhost:3000 and backend at http://localhost:5000."
