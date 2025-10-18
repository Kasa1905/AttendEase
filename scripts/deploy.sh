#!/bin/bash
set -e

ENV=${1:-production}

if [ "$ENV" = "development" ]; then
  COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml"
else
  COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
fi

echo "Building and deploying for $ENV..."
docker-compose $COMPOSE_FILES build

echo "Running migrations..."
docker-compose $COMPOSE_FILES run backend npx sequelize db:migrate

echo "Starting services..."
docker-compose $COMPOSE_FILES up -d

echo "Running health checks..."
./scripts/health-check.sh

echo "Deployment complete."
