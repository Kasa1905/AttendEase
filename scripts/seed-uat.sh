#!/bin/bash

# UAT Data Seeding Script for Club Attendance Manager
# This script populates the staging database with test data for User Acceptance Testing (UAT)
# Usage: ./seed-uat.sh [options]
#   Options:
#     --clean-only     Only clean existing UAT data without re-seeding
#     --skip-confirm   Skip confirmation prompt
#     --help           Show this help message

# Exit on error
set -e

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default options
CLEAN_ONLY=false
SKIP_CONFIRM=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --clean-only)
      CLEAN_ONLY=true
      ;;
    --skip-confirm)
      SKIP_CONFIRM=true
      ;;
    --help)
      echo "Usage: ./seed-uat.sh [options]"
      echo "  Options:"
      echo "    --clean-only     Only clean existing UAT data without re-seeding"
      echo "    --skip-confirm   Skip confirmation prompt"
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

# Ensure we're running in staging environment
export NODE_ENV=staging

echo "=========================================================="
echo "     Club Attendance Manager - UAT Data Seeding Tool      "
echo "=========================================================="
echo ""
echo "This script will seed the staging database with test data for User Acceptance Testing."
echo "WARNING: This will delete any existing UAT data in the database."
echo ""

# Ask for confirmation unless skipped
if [ "$SKIP_CONFIRM" != "true" ]; then
  read -p "Do you want to continue? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation canceled."
    exit 0
  fi
fi

# Determine if we're running in Docker or directly on the host
if [ -f /.dockerenv ] || [ -f /proc/self/cgroup ] && grep -q "docker" /proc/self/cgroup; then
  # We're inside a Docker container
  echo "Running inside Docker container..."
  IN_DOCKER=true
else
  # We're on the host
  echo "Running on host system..."
  IN_DOCKER=false
fi

# Function to run a command in the backend container
run_in_backend() {
  if [ "$IN_DOCKER" = true ]; then
    # If we're in a Docker container, run the command directly
    cd /app && $@
  else
    # If we're on the host, run the command in the backend container
    docker-compose -f "$PROJECT_ROOT/docker-compose.staging.yml" exec -T backend bash -c "$@"
  fi
}

# Function to clean UAT data
clean_uat_data() {
  echo "Cleaning existing UAT data..."
  
  run_in_backend "cd /app && \
    npx sequelize-cli db:seed:undo --seed uat/002-uat-attendance-data.js && \
    npx sequelize-cli db:seed:undo --seed uat/001-uat-users.js"
  
  echo "UAT data has been cleaned successfully."
}

# Function to seed UAT data
seed_uat_data() {
  echo "Seeding UAT data..."
  
  # Run database migrations to ensure schema is up to date
  echo "Ensuring database schema is up to date..."
  run_in_backend "cd /app && npx sequelize-cli db:migrate"
  
  # Run the UAT seeders in order
  echo "Creating UAT test users..."
  run_in_backend "cd /app && npx sequelize-cli db:seed --seed uat/001-uat-users.js"
  
  echo "Creating UAT attendance data (events, records, duty sessions, etc.)..."
  run_in_backend "cd /app && npx sequelize-cli db:seed --seed uat/002-uat-attendance-data.js"
  
  echo "UAT data has been seeded successfully!"
}

# Main execution flow
clean_uat_data

# Exit if clean only
if [ "$CLEAN_ONLY" = true ]; then
  echo "Clean-only mode specified. Exiting without re-seeding."
  exit 0
fi

# Seed new data
seed_uat_data

# Output UAT login information
echo ""
echo "=========================================================="
echo "                 UAT Access Information                   "
echo "=========================================================="
echo ""
echo "The staging environment has been seeded with UAT test data."
echo ""
echo "Test user credentials:"
echo "======================"
echo "Admin:     admin.uat@clubattendance.example / UAT_Staging2025!"
echo "Manager:   manager.uat@clubattendance.example / UAT_Staging2025!"
echo "Member:    active.member.uat@clubattendance.example / UAT_Staging2025!"
echo ""
echo "All users have the same password: UAT_Staging2025!"
echo ""
echo "Access the staging environment at: https://staging.clubattendance.example"
echo ""
echo "For more information on test data and scenarios, please see:"
echo "- /opt/club-attendance/uat/test-scenarios.md"
echo "- /opt/club-attendance/uat/test-data-guide.md"
echo ""
echo "The staging environment is now ready for User Acceptance Testing."
echo "=========================================================="

exit 0