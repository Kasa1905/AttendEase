#!/bin/bash
# Database Backup Monitoring Script
# This script monitors backup processes, validates backups, and reports issues

set -e

#######################################################
# Configuration - Environment variables can override these
#######################################################

# Backup settings
BACKUP_DIR=${BACKUP_DIR:-"backups"}
BACKUP_LOG_DIR=${BACKUP_LOG_DIR:-"backups/logs"}
ALERT_THRESHOLD_HOURS=${ALERT_THRESHOLD_HOURS:-24}
BACKUP_SIZE_THRESHOLD_PERCENT=${BACKUP_SIZE_THRESHOLD_PERCENT:-20}
MAX_AGE_DAYS=${MAX_AGE_DAYS:-30}
BACKUP_PREFIX=${BACKUP_PREFIX:-"clubdb"}
BACKUP_FILE_PATTERN=${BACKUP_FILE_PATTERN:-"${BACKUP_PREFIX}_*.sql.gz*"}
COMPLETION_MESSAGE=${COMPLETION_MESSAGE:-"Backup process completed successfully"}

# Database connection
DB_HOST=${DB_HOST:-"db"}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-"clubdb"}
DB_USER=${DB_USER:-"clubadmin"}
DB_PASSWORD=${DB_PASSWORD:-""}
DB_CONTAINER=${DB_CONTAINER:-"db"}

# Notification settings
ENABLE_NOTIFICATIONS=${ENABLE_NOTIFICATIONS:-true}
NOTIFICATION_EMAIL=${NOTIFICATION_EMAIL:-"admin@clubattendance.example"}
ENABLE_SLACK=${ENABLE_SLACK:-true}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}
ENABLE_METRICS=${ENABLE_METRICS:-true}
METRICS_FILE=${METRICS_FILE:-"/tmp/backup_metrics.prom"}
MONITORING_ENDPOINT=${MONITORING_ENDPOINT:-""}

# Cloud storage settings
CLOUD_PROVIDER=${CLOUD_PROVIDER:-""}  # aws, gcp, azure, or none
CLOUD_BUCKET=${CLOUD_BUCKET:-""}
AWS_PROFILE=${AWS_PROFILE:-"default"}
GCP_PROJECT=${GCP_PROJECT:-""}
AZURE_STORAGE_ACCOUNT=${AZURE_STORAGE_ACCOUNT:-""}

# Set timestamp and log file
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
MONITOR_LOG="${BACKUP_LOG_DIR}/backup_monitor_${TIMESTAMP}.log"

#######################################################
# Utility functions
#######################################################

log() {
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a "$MONITOR_LOG"
}

notify() {
    local subject="$1"
    local message="$2"
    local status="$3" # success, warning, error
    
    log "$subject: $message"
    
    if [[ "$ENABLE_NOTIFICATIONS" == "true" ]]; then
        # Email notification
        if [[ -n "$NOTIFICATION_EMAIL" ]]; then
            echo "$message" | mail -s "Backup Monitoring $status: $subject" "$NOTIFICATION_EMAIL"
        fi
        
        # Slack notification
        if [[ "$ENABLE_SLACK" == "true" && -n "$SLACK_WEBHOOK_URL" ]]; then
            local color="good"
            [[ "$status" == "warning" ]] && color="warning"
            [[ "$status" == "error" ]] && color="danger"
            
            curl -s -X POST -H 'Content-type: application/json' \
                --data "{\"attachments\":[{\"color\":\"$color\",\"title\":\"Backup Monitoring $status\",\"text\":\"$subject\n$message\"}]}" \
                "$SLACK_WEBHOOK_URL"
        fi
    fi
}

update_metrics() {
    if [[ "$ENABLE_METRICS" == "true" ]]; then
        local metric="$1"
        local value="$2"
        local labels="$3"
        
        # Create metrics file if it doesn't exist
        if [[ ! -f "$METRICS_FILE" ]]; then
            cat > "$METRICS_FILE" <<EOF
# HELP backup_last_success_timestamp Timestamp of the last successful backup
# TYPE backup_last_success_timestamp gauge
# HELP backup_size_bytes Size of the most recent backup in bytes
# TYPE backup_size_bytes gauge
# HELP backup_duration_seconds Duration of the last backup in seconds
# TYPE backup_duration_seconds gauge
# HELP backup_age_hours Hours since the last successful backup
# TYPE backup_age_hours gauge
# HELP backup_age_seconds Seconds since the last successful backup
# TYPE backup_age_seconds gauge
# HELP backup_success Boolean indicating if the last backup was successful (1) or failed (0)
# TYPE backup_success gauge
# HELP backup_errors_total Total number of backup errors
# TYPE backup_errors_total counter
# HELP backup_validation_success Boolean indicating if the backup validation was successful (1) or failed (0)
# TYPE backup_validation_success gauge
EOF
        fi
        
        # Update or append metric
        if grep -q "$metric{$labels}" "$METRICS_FILE"; then
            # Update existing metric
            sed -i.bak "s/^$metric{$labels}.*/$metric{$labels} $value/" "$METRICS_FILE"
        else
            # Append new metric
            echo "$metric{$labels} $value" >> "$METRICS_FILE"
        fi
        
        # Push metrics if endpoint is configured
        if [[ -n "$MONITORING_ENDPOINT" ]]; then
            curl -s -m 10 --data-binary @"$METRICS_FILE" "$MONITORING_ENDPOINT"
        fi
    fi
}

#######################################################
# Monitoring functions
#######################################################

check_backup_recency() {
    log "Checking backup recency..."
    
    # Find the most recent backup file
    local recent_backup=""
    
    if [[ -d "$BACKUP_DIR" ]]; then
        # Get list of backup files sorted by modification time (newest first)
        recent_backup=$(find "$BACKUP_DIR" -name "$BACKUP_FILE_PATTERN" -type f -printf "%T+ %p\n" | sort -r | head -n1 | awk '{print $2}')
    fi
    
    if [[ -z "$recent_backup" ]]; then
        notify "No backups found" "No backup files found in $BACKUP_DIR" "error"
        update_metrics "backup_errors_total{type=\"missing\"}" 1
        return 1
    fi
    
    log "Most recent backup: $recent_backup"
    
    # Check file age
    local file_timestamp=$(stat -c %Y "$recent_backup")
    local current_timestamp=$(date +%s)
    local age_seconds=$((current_timestamp - file_timestamp))
    local age_hours=$((age_seconds / 3600))
    
    update_metrics "backup_age_hours{}" "$age_hours"
    update_metrics "backup_age_seconds{}" "$age_seconds"
    
    if (( age_hours > ALERT_THRESHOLD_HOURS )); then
        notify "Backup too old" "Most recent backup is $age_hours hours old (threshold: $ALERT_THRESHOLD_HOURS hours)" "warning"
        return 1
    else
        log "Backup recency: $age_hours hours (within threshold of $ALERT_THRESHOLD_HOURS hours)"
        return 0
    fi
}

check_backup_logs() {
    log "Checking backup logs for errors..."
    
    if [[ ! -d "$BACKUP_LOG_DIR" ]]; then
        notify "Log directory missing" "Backup log directory not found: $BACKUP_LOG_DIR" "warning"
        return 1
    fi
    
    # Find the most recent log file
    local recent_log=$(find "$BACKUP_LOG_DIR" -name "backup_*.log" -type f -printf "%T+ %p\n" | sort -r | head -n1 | awk '{print $2}')
    
    if [[ -z "$recent_log" ]]; then
        notify "No backup logs" "No backup log files found in $BACKUP_LOG_DIR" "warning"
        return 1
    fi
    
    log "Checking most recent log: $recent_log"
    
    # Check for error messages in the log
    local error_count=$(grep -ciE "error|failed|failure|exception|critical" "$recent_log")
    
    if (( error_count > 0 )); then
        local error_sample=$(grep -iE "error|failed|failure|exception|critical" "$recent_log" | head -n5)
        notify "Errors in backup log" "Found $error_count errors in recent backup log. Sample: $error_sample" "error"
        update_metrics "backup_errors_total{type=\"log\"}" "$error_count"
        return 1
    fi
    
    # Check for successful backup completion message
    if ! grep -q "$COMPLETION_MESSAGE" "$recent_log"; then
        notify "Incomplete backup" "Recent backup log does not contain completion message" "warning"
        update_metrics "backup_success{}" 0
        return 1
    fi
    
    # Extract backup duration if available
    local duration=$(grep "Duration:" "$recent_log" | tail -n1 | sed -E 's/.*Duration: ([0-9:]+).*/\1/')
    
    if [[ -n "$duration" ]]; then
        # Convert HH:MM:SS to seconds
        local hours=$(echo "$duration" | cut -d: -f1)
        local minutes=$(echo "$duration" | cut -d: -f2)
        local seconds=$(echo "$duration" | cut -d: -f3)
        
        local duration_seconds=$((hours * 3600 + minutes * 60 + seconds))
        update_metrics "backup_duration_seconds{}" "$duration_seconds"
    fi
    
    log "Backup logs check passed"
    update_metrics "backup_success{}" 1
    return 0
}

validate_backup_files() {
    log "Validating backup files..."
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        notify "Backup directory missing" "Backup directory not found: $BACKUP_DIR" "error"
        return 1
    fi
    
    # Find the most recent backup file
    local recent_backup=$(find "$BACKUP_DIR" -name "$BACKUP_FILE_PATTERN" -type f -printf "%T+ %p\n" | sort -r | head -n1 | awk '{print $2}')
    
    if [[ -z "$recent_backup" ]]; then
        notify "No backups found" "No backup files found in $BACKUP_DIR" "error"
        return 1
    fi
    
    log "Validating most recent backup: $recent_backup"
    
    # Check file size
    local file_size=$(stat -c %s "$recent_backup")
    update_metrics "backup_size_bytes{}" "$file_size"
    
    if [[ "$file_size" -lt 1024 ]]; then
        notify "Backup too small" "Most recent backup is suspiciously small: $file_size bytes" "warning"
        return 1
    fi
    
    # Check file integrity
    if [[ "$recent_backup" == *.gpg ]]; then
        log "Checking encrypted backup integrity"
        if ! gpg --list-packets "$recent_backup" &> /dev/null; then
            notify "Corrupt backup" "Encrypted backup file appears to be corrupt" "error"
            update_metrics "backup_validation_success{}" 0
            return 1
        fi
    elif [[ "$recent_backup" == *.gz ]]; then
        log "Checking compressed backup integrity"
        if ! gzip -t "$recent_backup"; then
            notify "Corrupt backup" "Compressed backup file appears to be corrupt" "error"
            update_metrics "backup_validation_success{}" 0
            return 1
        fi
    fi
    
    log "Backup file validation passed"
    update_metrics "backup_validation_success{}" 1
    return 0
}

check_backup_size_consistency() {
    log "Checking backup size consistency..."
    
    # Find the most recent backups (up to 5)
    local backups=($(find "$BACKUP_DIR" -name "$BACKUP_FILE_PATTERN" -type f -printf "%T+ %p\n" | sort -r | head -n5 | awk '{print $2}'))
    
    if [ ${#backups[@]} -lt 2 ]; then
        log "Not enough backups to check size consistency"
        return 0
    fi
    
    local most_recent="${backups[0]}"
    local most_recent_size=$(stat -c %s "$most_recent")
    
    # Find the average size of previous backups
    local total_size=0
    local count=0
    
    for ((i=1; i<${#backups[@]}; i++)); do
        local size=$(stat -c %s "${backups[$i]}")
        total_size=$((total_size + size))
        count=$((count + 1))
    done
    
    local avg_size=$((total_size / count))
    
    # Calculate percentage difference
    local diff_percent=0
    if [ $avg_size -gt 0 ]; then
        local diff=$((most_recent_size - avg_size))
        diff_percent=$((diff * 100 / avg_size))
        # Take absolute value
        diff_percent=${diff_percent#-}
    fi
    
    log "Current backup: $most_recent_size bytes, Average of previous backups: $avg_size bytes, Difference: $diff_percent%"
    
    if [ $diff_percent -gt $BACKUP_SIZE_THRESHOLD_PERCENT ]; then
        notify "Backup size anomaly" "Current backup size differs by $diff_percent% from average (threshold: $BACKUP_SIZE_THRESHOLD_PERCENT%)" "warning"
        return 1
    fi
    
    return 0
}

check_cloud_storage_sync() {
    if [[ -z "$CLOUD_PROVIDER" || "$CLOUD_PROVIDER" == "none" ]]; then
        log "Cloud storage sync check skipped (no provider configured)"
        return 0
    fi
    
    log "Checking cloud storage sync status..."
    
    # Find the most recent backup file
    local recent_backup=$(find "$BACKUP_DIR" -name "$BACKUP_FILE_PATTERN" -type f -printf "%T+ %p\n" | sort -r | head -n1 | awk '{print $2}')
    
    if [[ -z "$recent_backup" ]]; then
        log "No local backups found, skipping cloud sync check"
        return 0
    fi
    
    local backup_filename=$(basename "$recent_backup")
    local sync_status=1
    
    case "$CLOUD_PROVIDER" in
        aws)
            if [[ -n "$CLOUD_BUCKET" ]]; then
                if ! aws s3 --profile "$AWS_PROFILE" ls "s3://$CLOUD_BUCKET/$backup_filename" &> /dev/null; then
                    notify "Cloud sync failure" "Most recent backup not found in AWS S3 bucket" "warning"
                    sync_status=0
                fi
            else
                log "AWS S3 bucket not configured, skipping cloud sync check"
            fi
            ;;
        gcp)
            if [[ -n "$CLOUD_BUCKET" ]]; then
                if ! gsutil -q stat "gs://$CLOUD_BUCKET/$backup_filename" &> /dev/null; then
                    notify "Cloud sync failure" "Most recent backup not found in GCP bucket" "warning"
                    sync_status=0
                fi
            else
                log "GCP bucket not configured, skipping cloud sync check"
            fi
            ;;
        azure)
            if [[ -n "$CLOUD_BUCKET" && -n "$AZURE_STORAGE_ACCOUNT" ]]; then
                if ! az storage blob exists --account-name "$AZURE_STORAGE_ACCOUNT" --container-name "$CLOUD_BUCKET" --name "$backup_filename" --query "exists" | grep -q "true"; then
                    notify "Cloud sync failure" "Most recent backup not found in Azure container" "warning"
                    sync_status=0
                fi
            else
                log "Azure container not configured, skipping cloud sync check"
            fi
            ;;
        *)
            log "Unknown cloud provider: $CLOUD_PROVIDER, skipping cloud sync check"
            ;;
    esac
    
    if [ $sync_status -eq 1 ]; then
        log "Cloud storage sync check passed"
    fi
    
    update_metrics "backup_cloud_sync_success{provider=\"$CLOUD_PROVIDER\"}" "$sync_status"
    return $((1-sync_status))
}

check_database_growth() {
    log "Checking database size growth..."
    
    # File to store database size history
    local history_file="${BACKUP_LOG_DIR}/db_size_history.txt"
    
    # Get current database size
    local current_size=""
    
    # Check if we're running inside Docker
    if [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q "docker" /proc/1/cgroup; then
        # We're inside a Docker container
        if [ -n "$DB_PASSWORD" ]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        
        current_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_database_size('$DB_NAME');" | tr -d ' ')
    else
        # We're on the host, use Docker Compose
        current_size=$(docker compose exec -T "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_database_size('$DB_NAME');" | tr -d ' ')
    fi
    
    if [[ -z "$current_size" || ! "$current_size" =~ ^[0-9]+$ ]]; then
        log "Failed to get current database size, skipping growth check"
        return 0
    fi
    
    log "Current database size: $current_size bytes"
    
    # Create history file if it doesn't exist
    if [[ ! -f "$history_file" ]]; then
        mkdir -p "$BACKUP_LOG_DIR"
        echo "# Date,Size(bytes)" > "$history_file"
    fi
    
    # Add current size to history
    echo "$(date +%Y-%m-%d),$current_size" >> "$history_file"
    
    # No need for further checks if we don't have enough history
    local history_lines=$(wc -l < "$history_file")
    if (( history_lines < 3 )); then
        log "Not enough size history for growth analysis"
        return 0
    fi
    
    # Analyze growth rate (comparing to size from ~1 week ago)
    local week_ago_line=$(tail -n 7 "$history_file" | head -n 1)
    if [[ -n "$week_ago_line" && "$week_ago_line" != "#"* ]]; then
        local week_ago_size=$(echo "$week_ago_line" | cut -d, -f2)
        
        if [[ -n "$week_ago_size" && "$week_ago_size" =~ ^[0-9]+$ && "$week_ago_size" -gt 0 ]]; then
            local growth_bytes=$((current_size - week_ago_size))
            local growth_percent=$((growth_bytes * 100 / week_ago_size))
            
            log "Weekly database growth: $growth_bytes bytes ($growth_percent%)"
            
            if (( growth_percent > 50 )); then
                notify "Unusual database growth" "Database has grown by $growth_percent% in the past week" "warning"
            fi
        fi
    fi
    
    return 0
}

cleanup_old_backups() {
    if [[ $MAX_AGE_DAYS -le 0 ]]; then
        log "Backup cleanup skipped (MAX_AGE_DAYS=$MAX_AGE_DAYS)"
        return 0
    fi
    
    log "Checking for old backups to clean up (older than $MAX_AGE_DAYS days)..."
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "Backup directory not found, skipping cleanup"
        return 0
    fi
    
    # Find backups older than MAX_AGE_DAYS
    local old_backups=($(find "$BACKUP_DIR" -name "$BACKUP_FILE_PATTERN" -type f -mtime +$MAX_AGE_DAYS))
    
    if [[ ${#old_backups[@]} -eq 0 ]]; then
        log "No old backups to clean up"
        return 0
    fi
    
    log "Found ${#old_backups[@]} old backups to clean up"
    
    # Remove old backups
    for backup in "${old_backups[@]}"; do
        log "Removing old backup: $backup"
        rm -f "$backup"
    done
    
    # Also clean up old logs
    find "$BACKUP_LOG_DIR" -name "*.log" -type f -mtime +$MAX_AGE_DAYS -delete
    
    log "Backup cleanup completed"
    return 0
}

generate_monitoring_report() {
    local report_file="${BACKUP_LOG_DIR}/backup_monitor_report_${TIMESTAMP}.txt"
    
    log "Generating monitoring report: $report_file"
    
    {
        echo "==================== BACKUP MONITORING REPORT ===================="
        echo "Date: $(date)"
        echo "Backup directory: $BACKUP_DIR"
        echo ""
        
        echo "==================== BACKUP FILES ===================="
        echo "Most recent backups:"
        find "$BACKUP_DIR" -name "$BACKUP_FILE_PATTERN" -type f -printf "%T+ %s bytes %p\n" | sort -r | head -n5
        echo ""
        
        echo "==================== BACKUP STATS ===================="
        local total_backups=$(find "$BACKUP_DIR" -name "$BACKUP_FILE_PATTERN" -type f | wc -l)
        echo "Total backup files: $total_backups"
        
        local most_recent=$(find "$BACKUP_DIR" -name "$BACKUP_FILE_PATTERN" -type f -printf "%T+ %p\n" | sort -r | head -n1)
        if [[ -n "$most_recent" ]]; then
            local file=$(echo "$most_recent" | awk '{print $2}')
            local mod_time=$(echo "$most_recent" | awk '{print $1}' | cut -d. -f1)
            local size=$(stat -c %s "$file")
            local size_mb=$((size / 1048576))
            
            echo "Most recent backup: $(basename "$file")"
            echo "    - Date: $mod_time"
            echo "    - Size: $size bytes ($size_mb MB)"
            echo "    - Age: $(($(date +%s) - $(stat -c %Y "$file"))) seconds"
        fi
        
        echo ""
        echo "==================== DATABASE STATS ===================="
        # Get database stats
        if [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q "docker" /proc/1/cgroup; then
            # We're inside a Docker container
            if [ -n "$DB_PASSWORD" ]; then
                export PGPASSWORD="$DB_PASSWORD"
            fi
            
            echo "Database size: $(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" | tr -d ' ')"
            echo "Total tables: $(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')"
            
            echo ""
            echo "Top 5 largest tables:"
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT table_name, pg_size_pretty(pg_total_relation_size(table_name::text)) AS size FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(table_name::text) DESC LIMIT 5;"
        else
            # We're on the host, use Docker Compose
            echo "Database size: $(docker compose exec -T "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" | tr -d ' ')"
            echo "Total tables: $(docker compose exec -T "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')"
            
            echo ""
            echo "Top 5 largest tables:"
            docker compose exec -T "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT table_name, pg_size_pretty(pg_total_relation_size(table_name::text)) AS size FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(table_name::text) DESC LIMIT 5;"
        fi
        
        echo ""
        echo "==================== MONITORING INFORMATION ===================="
        echo "Alert threshold: $ALERT_THRESHOLD_HOURS hours"
        echo "Size threshold: $BACKUP_SIZE_THRESHOLD_PERCENT%"
        echo "Max backup age: $MAX_AGE_DAYS days"
        echo "Cloud provider: ${CLOUD_PROVIDER:-"none"}"
        echo "Cloud bucket: ${CLOUD_BUCKET:-"none"}"
        echo ""
        
        echo "==================== MONITORING LOG ===================="
        echo "See detailed log at: $MONITOR_LOG"
        
    } > "$report_file"
    
    log "Monitoring report generated: $report_file"
    
    # Send report via email
    if [[ "$ENABLE_NOTIFICATIONS" == "true" && -n "$NOTIFICATION_EMAIL" ]]; then
        cat "$report_file" | mail -s "Backup Monitoring Report" "$NOTIFICATION_EMAIL"
    fi
}

#######################################################
# Main monitoring process
#######################################################

# Create log directory
mkdir -p "$BACKUP_LOG_DIR"

# Start logging
exec > >(tee -a "$MONITOR_LOG") 2>&1
log "Starting backup monitoring process"

# Display monitoring parameters
log "Backup directory: $BACKUP_DIR"
log "Alert threshold: $ALERT_THRESHOLD_HOURS hours"
log "Backup size threshold: $BACKUP_SIZE_THRESHOLD_PERCENT%"
log "Max backup age: $MAX_AGE_DAYS days"
log "Cloud provider: ${CLOUD_PROVIDER:-"none"}"

# Perform all monitoring checks
check_backup_recency
check_backup_logs
validate_backup_files
check_backup_size_consistency
check_cloud_storage_sync
check_database_growth
cleanup_old_backups

# Generate monitoring report
generate_monitoring_report

log "Backup monitoring process completed"