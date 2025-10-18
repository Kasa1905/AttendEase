#!/bin/bash
# Comprehensive Database Backup Script with Encryption and Cloud Storage

set -e

#######################################################
# Configuration - Environment variables can override these
#######################################################

# Backup settings
BACKUP_DIR=${BACKUP_DIR:-"backups"}
BACKUP_PREFIX=${BACKUP_PREFIX:-"clubdb"}
RETENTION_DAYS=${RETENTION_DAYS:-30}
BACKUP_TYPE=${BACKUP_TYPE:-"full"}  # full, schema, data
COMPRESSION_LEVEL=${COMPRESSION_LEVEL:-9}
ENCRYPT_BACKUP=${ENCRYPT_BACKUP:-true}
GPG_RECIPIENT=${GPG_RECIPIENT:-"backup@clubattendance.example"}

# Database connection
DB_HOST=${DB_HOST:-"db"}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-"clubdb"}
DB_USER=${DB_USER:-"clubadmin"}
DB_PASSWORD=${DB_PASSWORD:-""}
DB_CONTAINER=${DB_CONTAINER:-"db"}

# Cloud storage
ENABLE_CLOUD_STORAGE=${ENABLE_CLOUD_STORAGE:-false}
CLOUD_PROVIDER=${CLOUD_PROVIDER:-"s3"} # s3, gcs, azure
S3_BUCKET=${S3_BUCKET:-"club-attendance-backups"}
S3_PREFIX=${S3_PREFIX:-"database"}
GCS_BUCKET=${GCS_BUCKET:-"club-attendance-backups"}
AZURE_CONTAINER=${AZURE_CONTAINER:-"club-attendance-backups"}

# Notification settings
ENABLE_NOTIFICATIONS=${ENABLE_NOTIFICATIONS:-true}
NOTIFICATION_EMAIL=${NOTIFICATION_EMAIL:-"admin@clubattendance.example"}
ENABLE_SLACK=${ENABLE_SLACK:-false}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}

# File paths and storage
BACKUP_LOGS="${BACKUP_DIR}/logs"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_PREFIX}_${BACKUP_TYPE}_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"
ENCRYPTED_FILE="${COMPRESSED_FILE}.gpg"
LOG_FILE="${BACKUP_LOGS}/backup_${TIMESTAMP}.log"

#######################################################
# Utility functions
#######################################################

log() {
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a "$LOG_FILE"
}

notify() {
    local subject="$1"
    local message="$2"
    local status="$3" # success, warning, error
    
    log "$subject: $message"
    
    if [[ "$ENABLE_NOTIFICATIONS" == "true" ]]; then
        # Email notification
        if [[ -n "$NOTIFICATION_EMAIL" ]]; then
            echo "$message" | mail -s "Database Backup $status: $subject" "$NOTIFICATION_EMAIL"
        fi
        
        # Slack notification
        if [[ "$ENABLE_SLACK" == "true" && -n "$SLACK_WEBHOOK_URL" ]]; then
            local color="good"
            [[ "$status" == "warning" ]] && color="warning"
            [[ "$status" == "error" ]] && color="danger"
            
            curl -s -X POST -H 'Content-type: application/json' \
                --data "{\"attachments\":[{\"color\":\"$color\",\"title\":\"Database Backup $status\",\"text\":\"$subject\n$message\"}]}" \
                "$SLACK_WEBHOOK_URL"
        fi
    fi
}

cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days"
    find "$BACKUP_DIR" -name "${BACKUP_PREFIX}_*.sql*" -type f -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_LOGS" -name "backup_*.log" -type f -mtime +$RETENTION_DAYS -delete
}

upload_to_cloud() {
    if [[ "$ENABLE_CLOUD_STORAGE" != "true" ]]; then
        log "Cloud storage disabled, skipping upload"
        return 0
    fi
    
    local file_to_upload="$1"
    local filename=$(basename "$file_to_upload")
    
    log "Uploading $filename to cloud storage ($CLOUD_PROVIDER)"
    
    case "$CLOUD_PROVIDER" in
        s3)
            if command -v aws &> /dev/null; then
                aws s3 cp "$file_to_upload" "s3://${S3_BUCKET}/${S3_PREFIX}/$filename"
                log "Upload to S3 complete: s3://${S3_BUCKET}/${S3_PREFIX}/$filename"
            else
                notify "Cloud upload failed" "AWS CLI not installed" "error"
                return 1
            fi
            ;;
        gcs)
            if command -v gsutil &> /dev/null; then
                gsutil cp "$file_to_upload" "gs://${GCS_BUCKET}/$filename"
                log "Upload to GCS complete: gs://${GCS_BUCKET}/$filename"
            else
                notify "Cloud upload failed" "gsutil not installed" "error"
                return 1
            fi
            ;;
        azure)
            if command -v az &> /dev/null; then
                az storage blob upload --container-name "$AZURE_CONTAINER" --file "$file_to_upload" --name "$filename"
                log "Upload to Azure complete: ${AZURE_CONTAINER}/$filename"
            else
                notify "Cloud upload failed" "Azure CLI not installed" "error"
                return 1
            fi
            ;;
        *)
            notify "Cloud upload failed" "Unknown cloud provider: $CLOUD_PROVIDER" "error"
            return 1
            ;;
    esac
    
    return 0
}

verify_backup() {
    local file="$1"
    
    if [[ ! -f "$file" ]]; then
        notify "Backup verification failed" "File does not exist: $file" "error"
        return 1
    fi
    
    if [[ "$file" == *.gpg ]]; then
        # For encrypted backups, just check file integrity
        log "Verifying encrypted backup integrity"
        if gpg --list-packets "$file" &>/dev/null; then
            log "Encrypted backup is valid"
            return 0
        else
            notify "Backup verification failed" "Encrypted backup is corrupted" "error"
            return 1
        fi
    elif [[ "$file" == *.gz ]]; then
        # For compressed backups, check gzip integrity
        log "Verifying compressed backup integrity"
        if gzip -t "$file"; then
            log "Compressed backup is valid"
            return 0
        else
            notify "Backup verification failed" "Compressed backup is corrupted" "error"
            return 1
        fi
    else
        # For raw SQL backups, check if it's a valid SQL file
        log "Verifying SQL backup integrity"
        if head -n 10 "$file" | grep -q "PostgreSQL database dump"; then
            log "SQL backup is valid"
            return 0
        else
            notify "Backup verification failed" "SQL backup is corrupted" "error"
            return 1
        fi
    fi
}

#######################################################
# Main backup process
#######################################################

# Create backup directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_LOGS"

# Start logging
exec > >(tee -a "$LOG_FILE") 2>&1
log "Starting database backup process"
log "Backup type: $BACKUP_TYPE"

# Measure backup duration
start_time=$(date +%s)

# Create database dump
log "Creating database dump"

# Check if we're running inside Docker
if [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q "docker" /proc/1/cgroup; then
    # We're inside a Docker container
    if [ -n "$DB_PASSWORD" ]; then
        export PGPASSWORD="$DB_PASSWORD"
    fi
    
    case "$BACKUP_TYPE" in
        "schema")
            pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --schema-only > "$BACKUP_FILE"
            ;;
        "data")
            pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --data-only > "$BACKUP_FILE"
            ;;
        *)
            pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
            ;;
    esac
else
    # We're on the host, use Docker Compose
    case "$BACKUP_TYPE" in
        "schema")
            docker compose exec -T "$DB_CONTAINER" env PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" -d "$DB_NAME" --schema-only > "$BACKUP_FILE"
            ;;
        "data")
            docker compose exec -T "$DB_CONTAINER" env PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" -d "$DB_NAME" --data-only > "$BACKUP_FILE"
            ;;
        *)
            docker compose exec -T "$DB_CONTAINER" env PGPASSWORD="$DB_PASSWORD" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
            ;;
    esac
fi

# Check if dump was successful
if [ $? -ne 0 ]; then
    notify "Database backup failed" "Failed to create database dump" "error"
    exit 1
fi

log "Database dump completed successfully: $BACKUP_FILE"
backup_size=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup size: $backup_size"

# Compress the backup
log "Compressing backup with level $COMPRESSION_LEVEL"
gzip -"$COMPRESSION_LEVEL" "$BACKUP_FILE"
if [ $? -ne 0 ]; then
    notify "Backup compression failed" "Failed to compress $BACKUP_FILE" "error"
    exit 1
fi
log "Compression completed: $COMPRESSED_FILE"

# Encrypt the backup if enabled
final_backup="$COMPRESSED_FILE"
if [ "$ENCRYPT_BACKUP" = true ]; then
    log "Encrypting backup for recipient: $GPG_RECIPIENT"
    if ! command -v gpg &> /dev/null; then
        notify "Backup encryption skipped" "GPG is not installed" "warning"
    else
        gpg --recipient "$GPG_RECIPIENT" --encrypt "$COMPRESSED_FILE"
        if [ $? -ne 0 ]; then
            notify "Backup encryption failed" "Failed to encrypt $COMPRESSED_FILE" "error"
            exit 1
        fi
        log "Encryption completed: $ENCRYPTED_FILE"
        final_backup="$ENCRYPTED_FILE"
        
        # Remove the unencrypted compressed file
        rm "$COMPRESSED_FILE"
    fi
fi

# Verify backup integrity
verify_backup "$final_backup"
if [ $? -ne 0 ]; then
    exit 1
fi

# Upload to cloud storage
upload_to_cloud "$final_backup"

# Calculate backup duration
end_time=$(date +%s)
duration=$((end_time - start_time))
duration_formatted=$(printf "%02d:%02d:%02d" $((duration/3600)) $((duration%3600/60)) $((duration%60)))

# Clean up old backups
cleanup_old_backups

# Final backup summary
final_size=$(du -h "$final_backup" | cut -f1)
log "Backup process completed successfully"
log "Original size: $backup_size, Final size: $final_size"
log "Backup duration: $duration_formatted"

# Add success message for both formats for backward compatibility
log "Backup process completed successfully"
log "Backup completed successfully"

notify "Database backup completed" "File: $(basename "$final_backup"), Size: $final_size, Duration: $duration_formatted" "success"

# Generate metrics for monitoring
if [ -f /usr/bin/curl ] && [ -n "$PROMETHEUS_PUSHGATEWAY" ]; then
    log "Sending metrics to Prometheus Pushgateway"
    
    # Create a metrics file with all the metrics
    METRICS_FILE=$(mktemp)
    
    cat > "$METRICS_FILE" <<EOF
# HELP backup_last_success_timestamp Timestamp of the last successful backup
# TYPE backup_last_success_timestamp gauge
backup_last_success_timestamp{job="database_backup",instance="$HOSTNAME",database="$DB_NAME"} $(date +%s)

# HELP backup_size_bytes Size of the most recent backup in bytes
# TYPE backup_size_bytes gauge
backup_size_bytes{job="database_backup",instance="$HOSTNAME",database="$DB_NAME"} $(stat -c%s "$final_backup")

# HELP backup_duration_seconds Duration of the last backup in seconds
# TYPE backup_duration_seconds gauge
backup_duration_seconds{job="database_backup",instance="$HOSTNAME",database="$DB_NAME"} $duration

# HELP backup_success Boolean indicating if the last backup was successful (1) or failed (0)
# TYPE backup_success gauge
backup_success{job="database_backup",instance="$HOSTNAME",database="$DB_NAME"} 1
EOF

    # Send all metrics in a single request
    curl --data-binary @"$METRICS_FILE" "$PROMETHEUS_PUSHGATEWAY/metrics"
    
    # Clean up temp file
    rm -f "$METRICS_FILE"
fi
