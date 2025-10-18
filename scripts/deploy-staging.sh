#!/bin/bash

# Staging Deployment Script for Club Attendance Manager
# This script deploys the application to the staging environment
# Usage: ./deploy-staging.sh [options]
#   Options:
#     --skip-build     Skip building the Docker images
#     --skip-tests     Skip running tests
#     --force          Force deployment even if tests fail
#     --seed-uat       Seed UAT data after deployment
#     --help           Show this help message

# Exit on error
set -e

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default options
SKIP_BUILD=false
SKIP_TESTS=false
FORCE=false
SEED_UAT=false
DEPLOYMENT_TAG="staging-$(date +%Y%m%d%H%M%S)"

# Set environment variables for docker-compose
export CONTAINER_REGISTRY=${CONTAINER_REGISTRY:-ghcr.io/your-org}
export IMAGE_TAG="staging-latest"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --skip-tests)
      SKIP_TESTS=true
      ;;
    --force)
      FORCE=true
      ;;
    --seed-uat)
      SEED_UAT=true
      ;;
    --help)
      echo "Usage: ./deploy-staging.sh [options]"
      echo "  Options:"
      echo "    --skip-build     Skip building the Docker images"
      echo "    --skip-tests     Skip running tests"
      echo "    --force          Force deployment even if tests fail"
      echo "    --seed-uat       Seed UAT data after deployment"
      echo "    --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
  shift
done

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.staging" ]; then
  echo "Loading environment variables from .env.staging..."
  source "$PROJECT_ROOT/.env.staging"
fi

# Ensure required variables are set
if [ -z "$STAGING_HOST" ]; then
  echo "Error: STAGING_HOST is not set. Please set it in .env.staging or export it."
  exit 1
fi

if [ -z "$CONTAINER_REGISTRY" ]; then
  echo "Error: CONTAINER_REGISTRY is not set. Please set it in .env.staging or export it."
  exit 1
fi

# Check if SSH key exists
if [ ! -f "$HOME/.ssh/id_rsa" ] && [ -z "$SSH_KEY_PATH" ]; then
  echo "Error: SSH key not found. Please ensure your SSH key is set up or specify SSH_KEY_PATH."
  exit 1
fi

SSH_KEY="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}"

# Function to run tests
run_tests() {
  echo "Running tests..."
  
  # Backend tests
  echo "Running backend tests..."
  cd "$PROJECT_ROOT/backend"
  npm test
  
  # Frontend tests
  echo "Running frontend tests..."
  cd "$PROJECT_ROOT/frontend"
  npm test
  
  echo "All tests passed!"
  return 0
}

# Function to build Docker images
build_images() {
  echo "Building Docker images..."
  
  # Set the tag for the images
  export IMAGE_TAG=$DEPLOYMENT_TAG
  echo "Using tag: $IMAGE_TAG"
  
  # Build backend image
  echo "Building backend image..."
  docker build -t "$CONTAINER_REGISTRY/club-attendance-backend:$IMAGE_TAG" \
               -t "$CONTAINER_REGISTRY/club-attendance-backend:staging-latest" \
               "$PROJECT_ROOT/backend"
  
  # Build frontend image
  echo "Building frontend image..."
  docker build -t "$CONTAINER_REGISTRY/club-attendance-frontend:$IMAGE_TAG" \
               -t "$CONTAINER_REGISTRY/club-attendance-frontend:staging-latest" \
               --build-arg NODE_ENV=staging \
               "$PROJECT_ROOT/frontend"
  
  echo "Docker images built successfully!"
  
  # Push images to registry
  echo "Pushing images to container registry..."
  docker push "$CONTAINER_REGISTRY/club-attendance-backend:$IMAGE_TAG"
  docker push "$CONTAINER_REGISTRY/club-attendance-backend:staging-latest"
  docker push "$CONTAINER_REGISTRY/club-attendance-frontend:$IMAGE_TAG"
  docker push "$CONTAINER_REGISTRY/club-attendance-frontend:staging-latest"
  
  echo "Images pushed successfully!"
  return 0
}

# Function to deploy to staging
deploy_to_staging() {
  echo "Deploying to staging server at $STAGING_HOST..."
  
  # Create temporary deployment directory if it doesn't exist
  ssh -i "$SSH_KEY" "$STAGING_USER@$STAGING_HOST" "mkdir -p /opt/club-attendance"
  
  # Copy necessary files
  echo "Copying configuration files to staging server..."
  scp -i "$SSH_KEY" "$PROJECT_ROOT/docker-compose.staging.yml" "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/"
  scp -i "$SSH_KEY" "$PROJECT_ROOT/nginx/staging.conf" "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/nginx/"
  scp -i "$SSH_KEY" "$PROJECT_ROOT/monitoring/docker-compose.monitoring.staging.yml" "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/monitoring/"
  scp -i "$SSH_KEY" "$PROJECT_ROOT/monitoring/prometheus-staging.yml" "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/monitoring/"
  scp -i "$SSH_KEY" "$PROJECT_ROOT/monitoring/grafana-staging-dashboards.json" "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/monitoring/"
  scp -i "$SSH_KEY" "$PROJECT_ROOT/monitoring/loki-staging-config.yaml" "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/monitoring/"
  scp -i "$SSH_KEY" "$PROJECT_ROOT/monitoring/promtail-staging-config.yaml" "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/monitoring/"
  scp -i "$SSH_KEY" "$PROJECT_ROOT/scripts/staging-health-check.sh" "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/scripts/"
  scp -i "$SSH_KEY" "$PROJECT_ROOT/scripts/seed-uat.sh" "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/scripts/"
  
  # Create root .env file for Redis password
  echo "Creating root .env file for Redis password..."
  cat > /tmp/root.env << EOF
REDIS_PASSWORD=${REDIS_PASSWORD:-your-secure-redis-password}
EOF
  
  # Create environment files with placeholders
  echo "Creating environment files with placeholders..."
  cat > /tmp/backend.env.staging << EOF
NODE_ENV=staging
PORT=5000
DATABASE_URL=${DATABASE_URL:-postgres://placeholder:password@db:5432/clubdb_staging}
REDIS_URL=${REDIS_URL:-redis://redis:6379/0}
REDIS_PASSWORD=${REDIS_PASSWORD:-}
JWT_SECRET=${JWT_SECRET:-placeholder_jwt_secret}
JWT_EXPIRES_IN=1d
CORS_ORIGIN=https://staging.clubattendance.example
LOG_LEVEL=info
LOG_PATH=/data/logs/backend
SMTP_HOST=${SMTP_HOST:-smtp.example.com}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-noreply@staging.clubattendance.example}
SMTP_PASS=${SMTP_PASS:-placeholder_smtp_password}
EMAIL_FROM=noreply@staging.clubattendance.example
SENTRY_DSN=${SENTRY_DSN:-}
DEPLOYMENT_ENV=staging
MONITORING_ENABLED=true
EOF

  cat > /tmp/frontend.env.staging << EOF
VITE_API_URL=https://staging.clubattendance.example/api
VITE_WEBSOCKET_URL=wss://staging.clubattendance.example
VITE_ENVIRONMENT=staging
VITE_SENTRY_DSN=${FRONTEND_SENTRY_DSN:-}
VITE_ENABLE_ANALYTICS=false
VITE_FEATURE_DUTY_SCHEDULING=true
VITE_FEATURE_LEAVE_REQUESTS=true
VITE_FEATURE_NOTIFICATIONS=true
VITE_VERSION=$DEPLOYMENT_TAG
VITE_BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

  # Transfer environment files
  scp -i "$SSH_KEY" /tmp/backend.env.staging "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/backend/.env.staging"
  scp -i "$SSH_KEY" /tmp/frontend.env.staging "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/frontend/.env.staging"
  scp -i "$SSH_KEY" /tmp/root.env "$STAGING_USER@$STAGING_HOST:/opt/club-attendance/.env"
  
  # Clean up temporary files
  rm -f /tmp/backend.env.staging /tmp/frontend.env.staging
  
  # Make scripts executable
  ssh -i "$SSH_KEY" "$STAGING_USER@$STAGING_HOST" "chmod +x /opt/club-attendance/scripts/*.sh"
  
  # Deploy to staging server
  echo "Deploying services to staging server..."
  ssh -i "$SSH_KEY" "$STAGING_USER@$STAGING_HOST" << EOF
    cd /opt/club-attendance
    
    # Set environment variables for docker-compose
    export COMPOSE_PROJECT_NAME=club-attendance-staging
    export IMAGE_TAG=$DEPLOYMENT_TAG
    
    # Pull the latest images
    docker-compose -f docker-compose.staging.yml pull
    
    # Update the monitoring stack first
    docker-compose -f monitoring/docker-compose.monitoring.staging.yml down
    docker-compose -f monitoring/docker-compose.monitoring.staging.yml up -d
    
    # Deploy the application
    docker-compose -f docker-compose.staging.yml down
    docker-compose -f docker-compose.staging.yml up -d
    
    # Run database migrations
    echo "Running database migrations..."
    sleep 10
    docker-compose -f docker-compose.staging.yml exec -T backend npx sequelize-cli db:migrate
    
    # Run health check
    echo "Running health check..."
    ./scripts/staging-health-check.sh
    
    if [ \$? -ne 0 ]; then
      echo "Warning: Health check failed!"
    else
      echo "Health check passed successfully!"
    fi
EOF
  
  echo "Deployment to staging completed!"
  return 0
}

# Function to seed UAT data
seed_uat_data() {
  echo "Seeding UAT data on staging server..."
  ssh -i "$SSH_KEY" "$STAGING_USER@$STAGING_HOST" "cd /opt/club-attendance && ./scripts/seed-uat.sh"
  return 0
}

# Function to send deployment notification
send_notification() {
  local status=$1
  local message=$2
  
  echo "Sending deployment notification: $message"
  
  # If Slack webhook is configured, send notification
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -s -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"*Club Attendance Manager Staging Deployment*\n$message\"}" \
      "$SLACK_WEBHOOK_URL"
  fi
  
  return 0
}

# Main deployment flow
echo "Starting deployment to staging environment..."
echo "Deployment tag: $DEPLOYMENT_TAG"

# Run tests unless skipped
if [ "$SKIP_TESTS" != "true" ]; then
  run_tests
  tests_result=$?
  if [ $tests_result -ne 0 ] && [ "$FORCE" != "true" ]; then
    echo "Error: Tests failed. Aborting deployment."
    send_notification "failed" "Deployment to staging failed: Tests did not pass. Run with --force to override."
    exit 1
  elif [ $tests_result -ne 0 ]; then
    echo "Warning: Tests failed but continuing due to --force flag."
    send_notification "warning" "Staging deployment proceeding despite test failures due to --force flag."
  fi
else
  echo "Skipping tests due to --skip-tests flag."
fi

# Build and push Docker images unless skipped
if [ "$SKIP_BUILD" != "true" ]; then
  build_images
  build_result=$?
  if [ $build_result -ne 0 ]; then
    echo "Error: Failed to build Docker images. Aborting deployment."
    send_notification "failed" "Deployment to staging failed: Could not build Docker images."
    exit 1
  fi
else
  echo "Skipping Docker image build due to --skip-build flag."
  echo "Using existing staging-latest images for deployment."
fi

# Deploy to staging
deploy_to_staging
deploy_result=$?
if [ $deploy_result -ne 0 ]; then
  echo "Error: Deployment to staging failed."
  send_notification "failed" "Deployment to staging failed during server setup."
  exit 1
fi

# Seed UAT data if requested
if [ "$SEED_UAT" = "true" ]; then
  seed_uat_data
  seed_result=$?
  if [ $seed_result -ne 0 ]; then
    echo "Warning: Failed to seed UAT data."
    send_notification "warning" "Deployment completed but UAT data seeding failed."
  else
    echo "UAT data seeded successfully."
  fi
fi

# Final notification
send_notification "success" "Deployment to staging completed successfully. Tag: $DEPLOYMENT_TAG"

echo "Deployment completed successfully!"
echo "Tag: $DEPLOYMENT_TAG"
echo "Access the staging environment at: https://staging.clubattendance.example"
exit 0