#!/bin/bash

# VPS-PK Cloud Platform - Backup & Disaster Recovery System
# Comprehensive backup, restore, and disaster recovery automation

set -e

# Configuration
BACKUP_DIR="/opt/vps-pk-cloud/backups"
LOG_DIR="/opt/vps-pk-cloud/logs"
RETENTION_DAYS=30
COMPRESSION_LEVEL=6
ENCRYPTION_ENABLED=true
REMOTE_BACKUP_ENABLED=true
REMOTE_BACKUP_URL="s3://vps-pk-backups"
NOTIFICATION_EMAIL="admin@vps-pk.com"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/backup.log"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/backup.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/backup.log"
}

# Create necessary directories
setup_directories() {
    log_info "Setting up backup directories..."
    
    mkdir -p "$BACKUP_DIR"/{full,incremental,database,config}
    mkdir -p "$LOG_DIR"
    
    log_info "Backup directories created"
}

# Full system backup
full_backup() {
    local backup_name="full-backup-$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/full/$backup_name"
    
    log_info "Starting full system backup: $backup_name"
    
    # Create backup directory
    mkdir -p "$backup_path"
    
    # Backup application files
    log_info "Backing up application files..."
    tar -czf "$backup_path/application.tar.gz" \
        --exclude=node_modules \
        --exclude=logs \
        --exclude=backups \
        --exclude=.git \
        /opt/vps-pk-cloud
    
    # Backup configuration files
    log_info "Backing up configuration files..."
    tar -czf "$backup_path/config.tar.gz" \
        /etc/nginx/sites-available/vps-pk-cloud \
        /etc/systemd/system/vps-pk-cloud.service \
        /opt/vps-pk-cloud/ecosystem.config.js
    
    # Backup database (if applicable)
    if command -v pg_dump &> /dev/null; then
        log_info "Backing up database..."
        pg_dump vpspk_cloud > "$backup_path/database.sql" 2>/dev/null || log_warn "Database backup failed or not applicable"
    fi
    
    # Create backup manifest
    cat > "$backup_path/manifest.json" <<EOF
{
    "backup_type": "full",
    "backup_name": "$backup_name",
    "timestamp": "$(date -Iseconds)",
    "size": "$(du -sh "$backup_path" | cut -f1)",
    "files": [
        "application.tar.gz",
        "config.tar.gz",
        "database.sql"
    ],
    "retention_days": $RETENTION_DAYS
}
EOF
    
    # Compress entire backup
    log_info "Compressing backup..."
    tar -czf "$BACKUP_DIR/full/$backup_name.tar.gz" -C "$BACKUP_DIR/full" "$backup_name"
    rm -rf "$backup_path"
    
    # Encrypt backup if enabled
    if [ "$ENCRYPTION_ENABLED" = true ]; then
        log_info "Encrypting backup..."
        gpg --symmetric --cipher-algo AES256 --compress-algo 1 \
            --output "$BACKUP_DIR/full/$backup_name.tar.gz.gpg" \
            "$BACKUP_DIR/full/$backup_name.tar.gz"
        rm "$BACKUP_DIR/full/$backup_name.tar.gz"
    fi
    
    # Upload to remote storage if enabled
    if [ "$REMOTE_BACKUP_ENABLED" = true ]; then
        upload_to_remote "$BACKUP_DIR/full/$backup_name.tar.gz$([ "$ENCRYPTION_ENABLED" = true ] && echo ".gpg")"
    fi
    
    log_info "Full backup completed: $backup_name"
    echo "$backup_name" > "$BACKUP_DIR/last_full_backup"
}

# Incremental backup
incremental_backup() {
    local backup_name="incremental-backup-$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/incremental/$backup_name"
    local last_backup_file="$BACKUP_DIR/last_full_backup"
    
    log_info "Starting incremental backup: $backup_name"
    
    # Check if we have a previous backup
    if [ ! -f "$last_backup_file" ]; then
        log_warn "No previous backup found, performing full backup instead"
        full_backup
        return
    fi
    
    local last_backup=$(cat "$last_backup_file")
    local last_backup_time=$(stat -c %Y "$BACKUP_DIR/full/$last_backup.tar.gz$([ "$ENCRYPTION_ENABLED" = true ] && echo ".gpg")" 2>/dev/null || echo "0")
    
    # Create backup directory
    mkdir -p "$backup_path"
    
    # Find changed files since last backup
    log_info "Finding changed files since last backup..."
    find /opt/vps-pk-cloud \
        -type f \
        -newermt "@$last_backup_time" \
        ! -path "*/node_modules/*" \
        ! -path "*/logs/*" \
        ! -path "*/backups/*" \
        ! -path "*/.git/*" \
        -exec cp --parents {} "$backup_path" \; 2>/dev/null || true
    
    # Create incremental manifest
    cat > "$backup_path/manifest.json" <<EOF
{
    "backup_type": "incremental",
    "backup_name": "$backup_name",
    "timestamp": "$(date -Iseconds)",
    "base_backup": "$last_backup",
    "size": "$(du -sh "$backup_path" | cut -f1)",
    "retention_days": $RETENTION_DAYS
}
EOF
    
    # Compress incremental backup
    log_info "Compressing incremental backup..."
    tar -czf "$BACKUP_DIR/incremental/$backup_name.tar.gz" -C "$BACKUP_DIR/incremental" "$backup_name"
    rm -rf "$backup_path"
    
    # Encrypt if enabled
    if [ "$ENCRYPTION_ENABLED" = true ]; then
        log_info "Encrypting incremental backup..."
        gpg --symmetric --cipher-algo AES256 --compress-algo 1 \
            --output "$BACKUP_DIR/incremental/$backup_name.tar.gz.gpg" \
            "$BACKUP_DIR/incremental/$backup_name.tar.gz"
        rm "$BACKUP_DIR/incremental/$backup_name.tar.gz"
    fi
    
    # Upload to remote storage
    if [ "$REMOTE_BACKUP_ENABLED" = true ]; then
        upload_to_remote "$BACKUP_DIR/incremental/$backup_name.tar.gz$([ "$ENCRYPTION_ENABLED" = true ] && echo ".gpg")"
    fi
    
    log_info "Incremental backup completed: $backup_name"
}

# Database backup
database_backup() {
    local backup_name="database-backup-$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/database/$backup_name"
    
    log_info "Starting database backup: $backup_name"
    
    mkdir -p "$backup_path"
    
    # PostgreSQL backup
    if command -v pg_dump &> /dev/null; then
        log_info "Backing up PostgreSQL database..."
        pg_dump vpspk_cloud > "$backup_path/postgresql.sql"
        pg_dumpall --globals-only > "$backup_path/postgresql_globals.sql"
    fi
    
    # MySQL backup
    if command -v mysqldump &> /dev/null; then
        log_info "Backing up MySQL database..."
        mysqldump --all-databases > "$backup_path/mysql.sql" 2>/dev/null || log_warn "MySQL backup failed"
    fi
    
    # MongoDB backup
    if command -v mongodump &> /dev/null; then
        log_info "Backing up MongoDB database..."
        mongodump --out "$backup_path/mongodb" 2>/dev/null || log_warn "MongoDB backup failed"
    fi
    
    # Compress database backup
    tar -czf "$BACKUP_DIR/database/$backup_name.tar.gz" -C "$BACKUP_DIR/database" "$backup_name"
    rm -rf "$backup_path"
    
    # Encrypt if enabled
    if [ "$ENCRYPTION_ENABLED" = true ]; then
        gpg --symmetric --cipher-algo AES256 --compress-algo 1 \
            --output "$BACKUP_DIR/database/$backup_name.tar.gz.gpg" \
            "$BACKUP_DIR/database/$backup_name.tar.gz"
        rm "$BACKUP_DIR/database/$backup_name.tar.gz"
    fi
    
    log_info "Database backup completed: $backup_name"
}

# Upload to remote storage
upload_to_remote() {
    local backup_file="$1"
    local remote_path="$REMOTE_BACKUP_URL/$(basename "$backup_file")"
    
    log_info "Uploading backup to remote storage: $remote_path"
    
    # AWS S3 upload
    if command -v aws &> /dev/null; then
        aws s3 cp "$backup_file" "$remote_path" || log_error "Failed to upload to S3"
    # Google Cloud Storage upload
    elif command -v gsutil &> /dev/null; then
        gsutil cp "$backup_file" "$remote_path" || log_error "Failed to upload to GCS"
    # Azure Blob Storage upload
    elif command -v az &> /dev/null; then
        az storage blob upload --file "$backup_file" --container-name backups --name "$(basename "$backup_file")" || log_error "Failed to upload to Azure"
    else
        log_warn "No cloud storage client found, skipping remote upload"
    fi
}

# Restore from backup
restore_backup() {
    local backup_name="$1"
    local restore_type="${2:-full}"
    
    if [ -z "$backup_name" ]; then
        log_error "Backup name is required for restore"
        return 1
    fi
    
    log_info "Starting restore from backup: $backup_name"
    
    local backup_file=""
    case "$restore_type" in
        "full")
            backup_file="$BACKUP_DIR/full/$backup_name.tar.gz"
            ;;
        "incremental")
            backup_file="$BACKUP_DIR/incremental/$backup_name.tar.gz"
            ;;
        "database")
            backup_file="$BACKUP_DIR/database/$backup_name.tar.gz"
            ;;
        *)
            log_error "Invalid restore type: $restore_type"
            return 1
            ;;
    esac
    
    # Check if encrypted
    if [ -f "${backup_file}.gpg" ]; then
        backup_file="${backup_file}.gpg"
        log_info "Decrypting backup..."
        gpg --decrypt "$backup_file" | tar -xzf - -C /tmp/ || {
            log_error "Failed to decrypt and extract backup"
            return 1
        }
    else
        log_info "Extracting backup..."
        tar -xzf "$backup_file" -C /tmp/ || {
            log_error "Failed to extract backup"
            return 1
        }
    fi
    
    # Stop services
    log_info "Stopping services..."
    pm2 stop vps-pk-cloud || true
    sudo systemctl stop nginx || true
    
    # Restore application files
    if [ "$restore_type" != "database" ]; then
        log_info "Restoring application files..."
        tar -xzf /tmp/*/application.tar.gz -C / || {
            log_error "Failed to restore application files"
            return 1
        }
        
        # Restore configuration files
        log_info "Restoring configuration files..."
        tar -xzf /tmp/*/config.tar.gz -C / || {
            log_error "Failed to restore configuration files"
            return 1
        }
    fi
    
    # Restore database
    if [ -f "/tmp/*/database.sql" ]; then
        log_info "Restoring database..."
        psql vpspk_cloud < /tmp/*/database.sql || {
            log_error "Failed to restore database"
            return 1
        }
    fi
    
    # Restart services
    log_info "Restarting services..."
    sudo systemctl start nginx
    pm2 start ecosystem.config.js
    
    # Cleanup
    rm -rf /tmp/*
    
    log_info "Restore completed successfully"
}

# Cleanup old backups
cleanup_backups() {
    log_info "Cleaning up old backups..."
    
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
    
    # Cleanup full backups
    find "$BACKUP_DIR/full" -name "*.tar.gz*" -type f -exec basename {} \; | \
    while read backup; do
        backup_date=$(echo "$backup" | grep -o '[0-9]\{8\}' | head -1)
        if [ "$backup_date" -lt "$cutoff_date" ]; then
            log_info "Removing old backup: $backup"
            rm -f "$BACKUP_DIR/full/$backup"
        fi
    done
    
    # Cleanup incremental backups
    find "$BACKUP_DIR/incremental" -name "*.tar.gz*" -type f -exec basename {} \; | \
    while read backup; do
        backup_date=$(echo "$backup" | grep -o '[0-9]\{8\}' | head -1)
        if [ "$backup_date" -lt "$cutoff_date" ]; then
            log_info "Removing old incremental backup: $backup"
            rm -f "$BACKUP_DIR/incremental/$backup"
        fi
    done
    
    # Cleanup database backups
    find "$BACKUP_DIR/database" -name "*.tar.gz*" -type f -exec basename {} \; | \
    while read backup; do
        backup_date=$(echo "$backup" | grep -o '[0-9]\{8\}' | head -1)
        if [ "$backup_date" -lt "$cutoff_date" ]; then
            log_info "Removing old database backup: $backup"
            rm -f "$BACKUP_DIR/database/$backup"
        fi
    done
    
    log_info "Backup cleanup completed"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        log_error "Backup file is required for verification"
        return 1
    fi
    
    log_info "Verifying backup integrity: $backup_file"
    
    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    # Check if encrypted
    if [[ "$backup_file" == *.gpg ]]; then
        log_info "Verifying encrypted backup..."
        gpg --verify "$backup_file" 2>/dev/null || {
            log_error "Backup verification failed: Invalid encryption"
            return 1
        }
    else
        log_info "Verifying backup archive..."
        tar -tzf "$backup_file" > /dev/null || {
            log_error "Backup verification failed: Corrupted archive"
            return 1
        }
    fi
    
    log_info "Backup verification successful"
    return 0
}

# List available backups
list_backups() {
    log_info "Available backups:"
    
    echo -e "\n${BLUE}Full Backups:${NC}"
    ls -la "$BACKUP_DIR/full"/*.tar.gz* 2>/dev/null | while read line; do
        echo "  $line"
    done
    
    echo -e "\n${BLUE}Incremental Backups:${NC}"
    ls -la "$BACKUP_DIR/incremental"/*.tar.gz* 2>/dev/null | while read line; do
        echo "  $line"
    done
    
    echo -e "\n${BLUE}Database Backups:${NC}"
    ls -la "$BACKUP_DIR/database"/*.tar.gz* 2>/dev/null | while read line; do
        echo "  $line"
    done
}

# Send notification
send_notification() {
    local subject="$1"
    local message="$2"
    
    if [ -n "$NOTIFICATION_EMAIL" ]; then
        echo "$message" | mail -s "$subject" "$NOTIFICATION_EMAIL" || log_warn "Failed to send notification email"
    fi
}

# Main function
main() {
    case "${1:-help}" in
        "full")
            setup_directories
            full_backup
            cleanup_backups
            send_notification "VPS-PK Cloud - Full Backup Completed" "Full backup completed successfully at $(date)"
            ;;
        "incremental")
            setup_directories
            incremental_backup
            cleanup_backups
            send_notification "VPS-PK Cloud - Incremental Backup Completed" "Incremental backup completed successfully at $(date)"
            ;;
        "database")
            setup_directories
            database_backup
            cleanup_backups
            send_notification "VPS-PK Cloud - Database Backup Completed" "Database backup completed successfully at $(date)"
            ;;
        "restore")
            restore_backup "$2" "$3"
            ;;
        "verify")
            verify_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        "cleanup")
            cleanup_backups
            ;;
        "help"|*)
            echo "VPS-PK Cloud Platform - Backup & Recovery System"
            echo ""
            echo "Usage: $0 {full|incremental|database|restore|verify|list|cleanup}"
            echo ""
            echo "Commands:"
            echo "  full                    - Create full system backup"
            echo "  incremental             - Create incremental backup"
            echo "  database                - Create database backup"
            echo "  restore <backup> [type] - Restore from backup"
            echo "  verify <backup>         - Verify backup integrity"
            echo "  list                    - List available backups"
            echo "  cleanup                 - Cleanup old backups"
            echo ""
            echo "Examples:"
            echo "  $0 full"
            echo "  $0 restore full-backup-20240910_120000"
            echo "  $0 verify full-backup-20240910_120000.tar.gz"
            ;;
    esac
}

# Run main function
main "$@"
