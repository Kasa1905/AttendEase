#!/bin/bash

# Staging Environment Health Check Script
# This script performs health checks on all components of the staging environment

# Configuration
STAGING_BASE_URL="https://staging.clubattendance.example"
API_BASE_URL="${STAGING_BASE_URL}/api"
EMAIL_RECIPIENT="alerts@clubattendance.example.com"
LOG_FILE="/var/log/health-checks/staging-health.log"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
PAGER_DUTY_INTEGRATION_KEY="${PAGER_DUTY_INTEGRATION_KEY:-}"

# Create log directory if it doesn't exist
mkdir -p $(dirname $LOG_FILE)

# Log with timestamp
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Send an alert via email, Slack, and PagerDuty
send_alert() {
  local subject="$1"
  local message="$2"
  local severity="$3" # info, warning, or critical
  
  log "ALERT ($severity): $subject"
  
  # Send email alert
  echo -e "$message" | mail -s "[Staging] $subject" $EMAIL_RECIPIENT
  
  # Send Slack notification if webhook is configured
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    local icon=":warning:"; [ "$severity" = "critical" ] && icon=":red_circle:"
    curl -s -X POST -H 'Content-type: application/json' \
      --data "{\"text\":\"$icon *$subject*\n$message\"}" \
      $SLACK_WEBHOOK_URL
  fi
  
  # Send PagerDuty alert for critical issues
  if [ "$severity" == "critical" ] && [ -n "$PAGER_DUTY_INTEGRATION_KEY" ]; then
    curl -s -X POST -H 'Content-type: application/json' \
      --data "{
        \"routing_key\": \"$PAGER_DUTY_INTEGRATION_KEY\",
        \"event_action\": \"trigger\",
        \"payload\": {
          \"summary\": \"$subject\",
          \"source\": \"Staging Health Check\",
          \"severity\": \"critical\",
          \"custom_details\": {
            \"message\": \"$message\"
          }
        }
      }" \
      https://events.pagerduty.com/v2/enqueue
  fi
}

log "Starting health check for staging environment"

# Check if frontend is accessible
check_frontend() {
  log "Checking frontend..."
  
  local status_code=$(curl -s -o /dev/null -w "%{http_code}" $STAGING_BASE_URL)
  
  if [ $status_code -ne 200 ]; then
    send_alert "Frontend is down" "The staging frontend returned HTTP $status_code" "critical"
    return 1
  else
    log "Frontend is up (HTTP $status_code)"
    return 0
  fi
}

# Check if API is accessible and responding
check_api() {
  log "Checking API health..."
  
  local response=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/health)
  
  if [ $response -ne 200 ]; then
    send_alert "API is down" "The staging API health endpoint returned HTTP $response" "critical"
    return 1
  else
    log "API is up (HTTP $response)"
    
    # Check API response time
    local response_time=$(curl -s -w "%{time_total}" -o /dev/null $API_BASE_URL/health)
    
    if (( $(echo "$response_time > 2.0" | bc -l) )); then
      send_alert "API response time degraded" "API response time is ${response_time}s (threshold: 2.0s)" "warning"
    else
      log "API response time: ${response_time}s"
    fi
    
    return 0
  fi
}

# Check database connectivity through general API health
check_database() {
  log "Checking database connectivity (via API health)..."
  
  # Using the main API health check as a proxy for database health
  # If the API is healthy, we assume the database is connected
  local response=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/health)
  
  if [ $response -ne 200 ]; then
    send_alert "Database connectivity issue" "Inferred from API health check failure (HTTP $response)" "critical"
    return 1
  else
    log "Database is inferred to be connected (via API health)"
    return 0
  fi
}

# Check Redis connectivity through general API health
check_redis() {
  log "Checking Redis connectivity (via API health)..."
  
  # Using the main API health check as a proxy for Redis health
  # If the API is healthy, we assume Redis is connected
  local response=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/health)
  
  if [ $response -ne 200 ]; then
    send_alert "Redis connectivity issue" "Inferred from API health check failure (HTTP $response)" "critical"
    return 1
  else
    log "Redis is inferred to be connected (via API health)"
    return 0
  fi
}

# Check disk space
check_disk_space() {
  log "Checking disk space..."
  
  local threshold=85
  local usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
  
  if [ $usage -gt $threshold ]; then
    send_alert "Low disk space" "Disk usage is at ${usage}% (threshold: ${threshold}%)" "warning"
    return 1
  else
    log "Disk space is adequate (${usage}%)"
    return 0
  fi
}

# Check memory usage
check_memory() {
  log "Checking memory usage..."
  
  local threshold=90
  local usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
  
  if [ $usage -gt $threshold ]; then
    send_alert "High memory usage" "Memory usage is at ${usage}% (threshold: ${threshold}%)" "warning"
    return 1
  else
    log "Memory usage is adequate (${usage}%)"
    return 0
  fi
}

# Check CPU load
check_cpu_load() {
  log "Checking CPU load..."
  
  local threshold=1.5
  local load=$(uptime | awk '{print $(NF-2)}' | sed 's/,//')
  
  if (( $(echo "$load > $threshold" | bc -l) )); then
    send_alert "High CPU load" "CPU load is ${load} (threshold: ${threshold})" "warning"
    return 1
  else
    log "CPU load is normal (${load})"
    return 0
  fi
}

# Check Prometheus and monitoring stack
check_monitoring() {
  log "Checking monitoring services..."
  
  # Check Prometheus
  local prom_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/-/healthy)
  if [ "$prom_status" != "200" ]; then
    send_alert "Prometheus is down" "Prometheus health check returned HTTP $prom_status" "warning"
    prometheus_ok=false
  else
    log "Prometheus is up"
    prometheus_ok=true
  fi
  
  # Check Grafana
  local grafana_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/api/health)
  if [ "$grafana_status" != "200" ]; then
    send_alert "Grafana is down" "Grafana health check returned HTTP $grafana_status" "warning"
    grafana_ok=false
  else
    log "Grafana is up"
    grafana_ok=true
  fi
  
  # Check Loki
  local loki_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ready)
  if [ "$loki_status" != "200" ]; then
    send_alert "Loki is down" "Loki ready check returned HTTP $loki_status" "warning"
    loki_ok=false
  else
    log "Loki is up"
    loki_ok=true
  fi
  
  # Return overall status
  if $prometheus_ok && $grafana_ok && $loki_ok; then
    return 0
  else
    return 1
  fi
}

# Run all checks
frontend_ok=true
api_ok=true
db_ok=true
redis_ok=true
disk_ok=true
memory_ok=true
cpu_ok=true
monitoring_ok=true

check_frontend || frontend_ok=false
check_api || api_ok=false
check_database || db_ok=false
check_redis || redis_ok=false
check_disk_space || disk_ok=false
check_memory || memory_ok=false
check_cpu_load || cpu_ok=false
check_monitoring || monitoring_ok=false

# Summarize results
log "Health check summary:"
log "Frontend: $([ "$frontend_ok" = true ] && echo "OK" || echo "FAIL")"
log "API: $([ "$api_ok" = true ] && echo "OK" || echo "FAIL")"
log "Database: $([ "$db_ok" = true ] && echo "OK (inferred from API health)" || echo "FAIL")"
log "Redis: $([ "$redis_ok" = true ] && echo "OK (inferred from API health)" || echo "FAIL")"
log "Disk: $([ "$disk_ok" = true ] && echo "OK" || echo "FAIL")"
log "Memory: $([ "$memory_ok" = true ] && echo "OK" || echo "FAIL")"
log "CPU: $([ "$cpu_ok" = true ] && echo "OK" || echo "FAIL")"
log "Monitoring: $([ "$monitoring_ok" = true ] && echo "OK" || echo "FAIL")"

# Set exit code
if $frontend_ok && $api_ok && $db_ok && $redis_ok && $disk_ok && $memory_ok && $cpu_ok && $monitoring_ok; then
  log "All systems operational"
  exit 0
else
  log "One or more checks failed"
  exit 1
fi