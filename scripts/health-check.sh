#!/bin/bash
set -e

# Health check for backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health || echo 000)
if [ "$BACKEND_STATUS" != "200" ]; then
  echo "Backend health check failed: $BACKEND_STATUS"
  exit 1
fi

# Health check for frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || echo 000)
if [ "$FRONTEND_STATUS" != "200" ]; then
  echo "Frontend health check failed: $FRONTEND_STATUS"
  exit 1
fi

echo "All services healthy."
