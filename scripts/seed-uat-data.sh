#!/bin/bash

# UAT Seed Runner Script for Club Attendance Manager
# This script populates the staging database with test data for UAT

# Set environment variables
export NODE_ENV=staging

# Change to the backend directory
cd "$(dirname "$0")/../backend"

echo "Starting UAT data seeding process..."

# Run database migrations to ensure schema is up to date
echo "Ensuring database schema is up to date..."
npx sequelize-cli db:migrate

# Clear any existing UAT data first to prevent duplicates
echo "Cleaning up any existing UAT data..."
npx sequelize-cli db:seed:undo --seed uat/attendance-records.js
npx sequelize-cli db:seed:undo --seed uat/duty-sessions.js
npx sequelize-cli db:seed:undo --seed uat/events.js
npx sequelize-cli db:seed:undo --seed uat/users.js

# Run the UAT seeders in order
echo "Creating UAT test users..."
npx sequelize-cli db:seed --seed uat/users.js
if [ $? -ne 0 ]; then
    echo "Error: Failed to seed users data"
    exit 1
fi

echo "Creating UAT test events..."
npx sequelize-cli db:seed --seed uat/events.js
if [ $? -ne 0 ]; then
    echo "Error: Failed to seed events data"
    exit 1
fi

echo "Creating UAT attendance records..."
npx sequelize-cli db:seed --seed uat/attendance-records.js
if [ $? -ne 0 ]; then
    echo "Error: Failed to seed attendance records"
    exit 1
fi

echo "Creating UAT duty sessions..."
npx sequelize-cli db:seed --seed uat/duty-sessions.js
if [ $? -ne 0 ]; then
    echo "Error: Failed to seed duty sessions"
    exit 1
fi

echo "UAT data seeding completed successfully!"
echo ""
echo "Test user credentials:"
echo "======================"
echo "Admin:     admin.uat@clubattendance.example / UAT_Password123!"
echo "Manager:   manager.uat@clubattendance.example / UAT_Password123!"
echo "Member:    active.member.uat@clubattendance.example / UAT_Password123!"
echo ""
echo "All users have the same password: UAT_Password123!"
echo ""
echo "The staging environment is now ready for User Acceptance Testing."