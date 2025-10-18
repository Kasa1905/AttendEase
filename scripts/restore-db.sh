#!/bin/bash
# Comprehensive Database Restoration Script

set -e

#######################################################
# Configuration - Environment variables can override these
#######################################################

# Restoration settings
BACKUP_DIR=${BACKUP_DIR:-"backups"}
RESTORE_LOG_DIR=${RESTORE_LOG_DIR:-"backups/logs"}
BACKUP_FILE=${BACKUP_FILE:-""}
TEST_MODE=${TEST_MODE:-false}
VALIDATION_ONLY=${VALIDATION_ONLY:-false}
DROP_DATABASE=${DROP_DATABASE:-false}
CREATE_DATABASE=${CREATE_DATABASE:-true}
DISABLE_TRIGGERS=${DISABLE_TRIGGERS:-true}

# Database connection
DB_HOST=${DB_HOST:-"db"}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-"clubdb"}
DB_USER=${DB_USER:-"clubadmin"}
DB_PASSWORD=${DB_PASSWORD:-""}
DB_CONTAINER=${DB_CONTAINER:-"db"}
TEST_DB_NAME=${TEST_DB_NAME:-"clubdb_restore_test"}

# Notification settings
ENABLE_NOTIFICATIONS=${ENABLE_NOTIFICATIONS:-true}
NOTIFICATION_EMAIL=${NOTIFICATION_EMAIL:-"admin@clubattendance.example"}
ENABLE_SLACK=${ENABLE_SLACK:-false}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}

# Set timestamp and log file
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
RESTORE_LOG="${RESTORE_LOG_DIR}/restore_${TIMESTAMP}.log"

#######################################################
# Utility functions
#######################################################

log() {
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a "$RESTORE_LOG"
}

notify() {
    local subject="$1"
    local message="$2"
    local status="$3" # success, warning, error
    
    log "$subject: $message"
    
    if [[ "$ENABLE_NOTIFICATIONS" == "true" ]]; then
        # Email notification
        if [[ -n "$NOTIFICATION_EMAIL" ]]; then
            echo "$message" | mail -s "Database Restore $status: $subject" "$NOTIFICATION_EMAIL"
        fi
        
        # Slack notification
        if [[ "$ENABLE_SLACK" == "true" && -n "$SLACK_WEBHOOK_URL" ]]; then
            local color="good"
            [[ "$status" == "warning" ]] && color="warning"
            [[ "$status" == "error" ]] && color="danger"
            
            curl -s -X POST -H 'Content-type: application/json' \
                --data "{\"attachments\":[{\"color\":\"$color\",\"title\":\"Database Restore $status\",\"text\":\"$subject\n$message\"}]}" \
                "$SLACK_WEBHOOK_URL"
        fi
    fi
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if the backup file exists
    if [[ -z "$BACKUP_FILE" ]]; then
        notify "Restore failed" "No backup file specified. Use BACKUP_FILE environment variable." "error"
        exit 1
    fi
    
    # If it's a relative path, make it absolute
    if [[ ! "$BACKUP_FILE" = /* ]]; then
        BACKUP_FILE="$(pwd)/$BACKUP_FILE"
    fi
    
    if [[ ! -f "$BACKUP_FILE" ]]; then
        notify "Restore failed" "Backup file not found: $BACKUP_FILE" "error"
        exit 1
    fi
    
    log "Using backup file: $BACKUP_FILE"
    
    # Check file type and prepare for processing
    if [[ "$BACKUP_FILE" == *.gpg ]]; then
        if ! command -v gpg &> /dev/null; then
            notify "Restore failed" "GPG is not installed, cannot decrypt backup" "error"
            exit 1
        fi
        log "Backup is encrypted, will decrypt during restore"
    fi
    
    if [[ "$BACKUP_FILE" != *.sql && "$BACKUP_FILE" != *.sql.gz && "$BACKUP_FILE" != *.gz.gpg && "$BACKUP_FILE" != *.sql.gpg ]]; then
        notify "Restore failed" "Unsupported backup format. Expected .sql, .sql.gz, .sql.gpg, or .gz.gpg" "error"
        exit 1
    fi
    
    # Check database connection
    log "Checking database connection..."
    if [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q "docker" /proc/1/cgroup; then
        # We're inside a Docker container
        if [ -n "$DB_PASSWORD" ]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        
        if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; then
            notify "Restore failed" "Cannot connect to database server" "error"
            exit 1
        fi
    else
        # We're on the host, use docker-compose
        if ! docker-compose exec "$DB_CONTAINER" pg_isready; then
            notify "Restore failed" "Cannot connect to database container" "error"
            exit 1
        fi
    fi
    
    log "Prerequisites check passed"
}

verify_backup() {
    log "Verifying backup integrity..."
    
    local tmp_dir=$(mktemp -d)
    local sql_file=""
    
    # Process the backup file based on its format
    if [[ "$BACKUP_FILE" == *.gpg ]]; then
        log "Decrypting backup for verification..."
        if ! gpg --output "$tmp_dir/backup.gz" --decrypt "$BACKUP_FILE"; then
            rm -rf "$tmp_dir"
            notify "Restore failed" "Failed to decrypt backup file" "error"
            exit 1
        fi
        
        if [[ -f "$tmp_dir/backup.gz" ]]; then
            log "Testing compressed file integrity..."
            if ! gzip -t "$tmp_dir/backup.gz"; then
                rm -rf "$tmp_dir"
                notify "Restore failed" "Corrupted compressed backup" "error"
                exit 1
            fi
            
            log "Decompressing backup for verification..."
            if ! gunzip -c "$tmp_dir/backup.gz" > "$tmp_dir/backup.sql"; then
                rm -rf "$tmp_dir"
                notify "Restore failed" "Failed to decompress backup" "error"
                exit 1
            fi
            
            sql_file="$tmp_dir/backup.sql"
        else
            rm -rf "$tmp_dir"
            notify "Restore failed" "Decryption produced no output" "error"
            exit 1
        fi
    elif [[ "$BACKUP_FILE" == *.gz ]]; then
        log "Testing compressed file integrity..."
        if ! gzip -t "$BACKUP_FILE"; then
            rm -rf "$tmp_dir"
            notify "Restore failed" "Corrupted compressed backup" "error"
            exit 1
        fi
        
        log "Decompressing backup for verification..."
        if ! gunzip -c "$BACKUP_FILE" > "$tmp_dir/backup.sql"; then
            rm -rf "$tmp_dir"
            notify "Restore failed" "Failed to decompress backup" "error"
            exit 1
        fi
        
        sql_file="$tmp_dir/backup.sql"
    else
        # Plain SQL file
        log "Verifying SQL file..."
        if ! head -n 10 "$BACKUP_FILE" | grep -q "PostgreSQL database dump"; then
            rm -rf "$tmp_dir"
            notify "Restore failed" "Not a valid PostgreSQL dump file" "error"
            exit 1
        fi
        
        sql_file="$BACKUP_FILE"
    fi
    
    # Check SQL file content
    log "Verifying SQL content..."
    if ! grep -q "PostgreSQL database dump" "$sql_file"; then
        rm -rf "$tmp_dir"
        notify "Restore failed" "Not a valid PostgreSQL dump file" "error"
        exit 1
    fi
    
    # Check for specific tables to ensure it's a valid club attendance database backup
    local required_tables=("users" "events" "attendance_records")
    for table in "${required_tables[@]}"; do
        if ! grep -q "CREATE TABLE.*$table" "$sql_file"; then
            log "Warning: Could not find table '$table' in backup"
        fi
    done
    
    # Clean up
    rm -rf "$tmp_dir"
    
    log "Backup verification completed successfully"
    return 0
}

validate_test_restore() {
    local target_db="$1"
    log "Validating restored database: $target_db"
    
    # Check if we're running inside Docker
    if [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q "docker" /proc/1/cgroup; then
        # We're inside a Docker container
        if [ -n "$DB_PASSWORD" ]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        
        # Check if database exists
        if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$target_db"; then
            notify "Validation failed" "Restored database $target_db does not exist" "error"
            return 1
        fi
        
        # Count number of tables
        local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db" -c "\dt" -t | wc -l)
        log "Found $table_count tables in the restored database"
        
        if [ "$table_count" -eq 0 ]; then
            notify "Validation failed" "No tables found in restored database" "error"
            return 1
        fi
        
        # Check for specific required tables
        local required_tables=("users" "events" "attendance_records")
        for table in "${required_tables[@]}"; do
            if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db" -c "SELECT to_regclass('public.$table');" -t | grep -q "$table"; then
                notify "Validation warning" "Required table '$table' not found in restored database" "warning"
            fi
        done
    else
        # We're on the host, use docker-compose
        # Check if database exists
        if ! docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$target_db"; then
            notify "Validation failed" "Restored database $target_db does not exist" "error"
            return 1
        fi
        
        # Count number of tables
        local table_count=$(docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$target_db" -c "\dt" -t | wc -l)
        log "Found $table_count tables in the restored database"
        
        if [ "$table_count" -eq 0 ]; then
            notify "Validation failed" "No tables found in restored database" "error"
            return 1
        fi
        
        # Check for specific required tables
        local required_tables=("users" "events" "attendance_records")
        for table in "${required_tables[@]}"; do
            if ! docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$target_db" -c "SELECT to_regclass('public.$table');" -t | grep -q "$table"; then
                notify "Validation warning" "Required table '$table' not found in restored database" "warning"
            fi
        done
    fi
    
    log "Database validation completed successfully"
    return 0
}

perform_restore() {
    local target_db="$1"
    log "Starting database restoration to $target_db"
    
    # Process the backup file based on its format
    local restore_cmd=""
    
    # Check if we're running inside Docker
    if [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q "docker" /proc/1/cgroup; then
        # We're inside a Docker container
        if [ -n "$DB_PASSWORD" ]; then
            export PGPASSWORD="$DB_PASSWORD"
        fi
        
        # Create database if specified
        if [ "$CREATE_DATABASE" = true ]; then
            log "Creating database $target_db if it doesn't exist"
            
            # Check if database exists, drop it if needed
            if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$target_db"; then
                if [ "$DROP_DATABASE" = true ]; then
                    log "Dropping existing database $target_db"
                    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS $target_db;"
                    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $target_db OWNER $DB_USER;"
                else
                    log "Database $target_db already exists and DROP_DATABASE is false"
                fi
            else
                psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $target_db OWNER $DB_USER;"
            fi
        fi
        
        # Build restore command based on file type
        if [[ "$BACKUP_FILE" == *.gpg ]]; then
            log "Decrypting and restoring from encrypted backup"
            restore_cmd="gpg --decrypt $BACKUP_FILE | gunzip | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $target_db"
        elif [[ "$BACKUP_FILE" == *.gz ]]; then
            log "Restoring from compressed backup"
            restore_cmd="gunzip -c $BACKUP_FILE | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $target_db"
        else
            log "Restoring from SQL backup"
            restore_cmd="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $target_db -f $BACKUP_FILE"
        fi
    else
        # We're on the host, use docker-compose
        
        # Create database if specified
        if [ "$CREATE_DATABASE" = true ]; then
            log "Creating database $target_db if it doesn't exist"
            
            # Check if database exists, drop it if needed
            if docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$target_db"; then
                if [ "$DROP_DATABASE" = true ]; then
                    log "Dropping existing database $target_db"
                    docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $target_db;"
                    docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE $target_db OWNER $DB_USER;"
                else
                    log "Database $target_db already exists and DROP_DATABASE is false"
                fi
            else
                docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE $target_db OWNER $DB_USER;"
            fi
        fi
        
        # For docker-compose, we need to copy the file into the container first
        local tmp_file="/tmp/backup_restore_$(date +%s)"
        
        if [[ "$BACKUP_FILE" == *.gpg ]]; then
            log "Decrypting backup before sending to container"
            gpg --decrypt "$BACKUP_FILE" > "$tmp_file.gz"
            docker cp "$tmp_file.gz" "$DB_CONTAINER:/tmp/backup.gz"
            rm "$tmp_file.gz"
            restore_cmd="docker-compose exec $DB_CONTAINER bash -c 'gunzip -c /tmp/backup.gz | psql -U $DB_USER -d $target_db && rm /tmp/backup.gz'"
        elif [[ "$BACKUP_FILE" == *.gz ]]; then
            docker cp "$BACKUP_FILE" "$DB_CONTAINER:/tmp/backup.gz"
            restore_cmd="docker-compose exec $DB_CONTAINER bash -c 'gunzip -c /tmp/backup.gz | psql -U $DB_USER -d $target_db && rm /tmp/backup.gz'"
        else
            docker cp "$BACKUP_FILE" "$DB_CONTAINER:/tmp/backup.sql"
            restore_cmd="docker-compose exec $DB_CONTAINER bash -c 'psql -U $DB_USER -d $target_db -f /tmp/backup.sql && rm /tmp/backup.sql'"
        fi
    fi
    
    # Disable triggers if needed
    if [ "$DISABLE_TRIGGERS" = true ]; then
        log "Temporarily disabling triggers during restore"
        if [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q "docker" /proc/1/cgroup; then
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db" -c "SET session_replication_role = 'replica';"
        else
            docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$target_db" -c "SET session_replication_role = 'replica';"
        fi
    fi
    
    # Execute the restore command
    log "Executing restore command:"
    log "$restore_cmd"
    
    eval "$restore_cmd"
    restore_status=$?
    
    # Re-enable triggers if they were disabled
    if [ "$DISABLE_TRIGGERS" = true ]; then
        log "Re-enabling triggers after restore"
        if [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q "docker" /proc/1/cgroup; then
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db" -c "SET session_replication_role = 'origin';"
        else
            docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$target_db" -c "SET session_replication_role = 'origin';"
        fi
    fi
    
    if [ $restore_status -ne 0 ]; then
        notify "Restore failed" "Database restoration failed with error code $restore_status" "error"
        exit 1
    fi
    
    log "Database restoration completed successfully"
}

generate_report() {
    local status="$1"
    local duration="$2"
    local report_file="${RESTORE_LOG_DIR}/restore_report_${TIMESTAMP}.txt"
    
    log "Generating restore report: $report_file"
    
    {
        echo "====================== DATABASE RESTORE REPORT ======================"
        echo "Status: $status"
        echo "Date: $(date)"
        echo "Backup file: $BACKUP_FILE"
        echo "Restore duration: $duration"
        echo "Target database: $DB_NAME"
        echo "Test mode: $TEST_MODE"
        echo "Validation only: $VALIDATION_ONLY"
        echo ""
        echo "====================== DATABASE INFORMATION ======================"
        
        # Get database stats
        if [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q "docker" /proc/1/cgroup; then
            echo "Database Size: $(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" -t)"
            echo "Table Count: $(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" -t)"
            echo ""
            echo "Top 5 largest tables:"
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT table_name, pg_size_pretty(pg_total_relation_size(table_name::text)) AS size FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(table_name::text) DESC LIMIT 5;"
        else
            echo "Database Size: $(docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" -t)"
            echo "Table Count: $(docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" -t)"
            echo ""
            echo "Top 5 largest tables:"
            docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT table_name, pg_size_pretty(pg_total_relation_size(table_name::text)) AS size FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(table_name::text) DESC LIMIT 5;"
        fi
        
        echo ""
        echo "========================= RESTORE LOG ========================="
        echo "See detailed log at: $RESTORE_LOG"
        
    } > "$report_file"
    
    log "Restore report generated: $report_file"
    
    # Send report via email
    if [[ "$ENABLE_NOTIFICATIONS" == "true" && -n "$NOTIFICATION_EMAIL" ]]; then
        cat "$report_file" | mail -s "Database Restore Report - $status" "$NOTIFICATION_EMAIL"
    fi
}

#######################################################
# Main restore process
#######################################################

# Create log directory
mkdir -p "$RESTORE_LOG_DIR"

# Start logging
exec > >(tee -a "$RESTORE_LOG") 2>&1
log "Starting database restoration process"

# Display backup file and parameters
log "Backup file: $BACKUP_FILE"
log "Target database: $DB_NAME"
log "Test mode: $TEST_MODE"
log "Validation only: $VALIDATION_ONLY"
log "Drop existing database: $DROP_DATABASE"
log "Create database: $CREATE_DATABASE"
log "Disable triggers during restore: $DISABLE_TRIGGERS"

# Measure restoration duration
start_time=$(date +%s)

# Check prerequisites and validate backup
check_prerequisites
verify_backup

# If validation only mode, exit after verification
if [ "$VALIDATION_ONLY" = true ]; then
    log "Validation only mode - backup verification completed successfully"
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    duration_formatted=$(printf "%02d:%02d:%02d" $((duration/3600)) $((duration%3600/60)) $((duration%60)))
    
    notify "Backup validation completed" "Backup file is valid and ready for restoration" "success"
    generate_report "Validation Complete" "$duration_formatted"
    exit 0
fi

# In test mode, restore to a test database
if [ "$TEST_MODE" = true ]; then
    log "Test mode enabled - restoring to test database: $TEST_DB_NAME"
    perform_restore "$TEST_DB_NAME"
    validate_test_restore "$TEST_DB_NAME"
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    duration_formatted=$(printf "%02d:%02d:%02d" $((duration/3600)) $((duration%3600/60)) $((duration%60)))
    
    notify "Test restore completed" "Restore test to $TEST_DB_NAME was successful" "success"
    generate_report "Test Restore Complete" "$duration_formatted"
    
    # Clean up test database if it's not needed
    if [ -f /.dockerenv ] || [ -f /proc/1/cgroup ] && grep -q "docker" /proc/1/cgroup; then
        log "Cleaning up test database"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE $TEST_DB_NAME;"
    else
        log "Cleaning up test database"
        docker-compose exec "$DB_CONTAINER" psql -U "$DB_USER" -c "DROP DATABASE $TEST_DB_NAME;"
    fi
    
    exit 0
fi

# For actual restore to production database
log "Performing production restore to: $DB_NAME"

# Ask for confirmation before proceeding with production restore
echo ""
echo "WARNING: You are about to restore the database '$DB_NAME'."
echo "This operation will overwrite existing data if DROP_DATABASE=true."
echo ""
read -p "Do you want to proceed? (y/n) " confirm

if [[ "$confirm" != [yY] && "$confirm" != [yY][eE][sS] ]]; then
    log "Restore canceled by user"
    notify "Restore canceled" "Database restoration was canceled by user" "warning"
    exit 0
fi

# Perform the actual restoration
perform_restore "$DB_NAME"
validate_test_restore "$DB_NAME"

# Calculate duration
end_time=$(date +%s)
duration=$((end_time - start_time))
duration_formatted=$(printf "%02d:%02d:%02d" $((duration/3600)) $((duration%3600/60)) $((duration%60)))

# Final restore summary
notify "Database restoration completed" "Restore to $DB_NAME was successful - Duration: $duration_formatted" "success"
generate_report "Production Restore Complete" "$duration_formatted"

log "Database restoration process completed successfully"
log "Duration: $duration_formatted"