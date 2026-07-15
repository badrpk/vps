#!/bin/bash

# VPS-PK Cloud Platform - Final Production Deployment Script
# Complete deployment package for production launch

set -e

# Configuration
PLATFORM_NAME="VPS-PK Cloud Platform"
VERSION="1.0.0"
DEPLOYMENT_DIR="/opt/vps-pk-cloud"
SERVICE_USER="vpspk"
SERVICE_GROUP="vpspk"
LOG_DIR="/var/log/vps-pk-cloud"
BACKUP_DIR="/opt/backups/vps-pk-cloud"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check OS
    if [[ ! -f /etc/os-release ]]; then
        error "Cannot determine OS version"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 16 ]]; then
        error "Node.js version 16 or higher is required"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        warn "PM2 is not installed, will install it"
        npm install -g pm2
    fi
    
    # Check nginx
    if ! command -v nginx &> /dev/null; then
        warn "Nginx is not installed, will install it"
        apt-get update && apt-get install -y nginx
    fi
    
    # Check available disk space (minimum 5GB)
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    if [[ $AVAILABLE_SPACE -lt 5242880 ]]; then
        error "Insufficient disk space. At least 5GB required"
    fi
    
    # Check available memory (minimum 2GB)
    AVAILABLE_MEMORY=$(free -m | awk 'NR==2{print $7}')
    if [[ $AVAILABLE_MEMORY -lt 2048 ]]; then
        warn "Low memory available: ${AVAILABLE_MEMORY}MB"
    fi
    
    log "System requirements check completed"
}

# Create system user and directories
setup_system() {
    log "Setting up system user and directories..."
    
    # Create user and group
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd -r -s /bin/false -d "$DEPLOYMENT_DIR" "$SERVICE_USER"
        log "Created user: $SERVICE_USER"
    fi
    
    # Create directories
    mkdir -p "$DEPLOYMENT_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"
    mkdir -p "/etc/vps-pk-cloud"
    mkdir -p "/var/lib/vps-pk-cloud"
    
    # Set permissions
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DEPLOYMENT_DIR"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$LOG_DIR"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$BACKUP_DIR"
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "/var/lib/vps-pk-cloud"
    
    log "System setup completed"
}

# Install application
install_application() {
    log "Installing VPS-PK Cloud Platform..."
    
    # Copy application files
    cp -r . "$DEPLOYMENT_DIR/"
    cd "$DEPLOYMENT_DIR"
    
    # Install dependencies
    log "Installing Node.js dependencies..."
    npm ci --production
    
    # Set permissions
    chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DEPLOYMENT_DIR"
    chmod +x "$DEPLOYMENT_DIR/deploy-production.sh"
    chmod +x "$DEPLOYMENT_DIR/backup-recovery/backup-system.sh"
    
    # Create symlinks
    ln -sf "$DEPLOYMENT_DIR/server.js" "/usr/local/bin/vps-pk-cloud"
    
    log "Application installation completed"
}

# Configure PM2
setup_pm2() {
    log "Setting up PM2 process manager..."
    
    # Copy PM2 configuration
    cp "$DEPLOYMENT_DIR/ecosystem.config.js" "/etc/vps-pk-cloud/"
    
    # Update PM2 configuration with correct paths
    sed -i "s|/path/to/vps-pk-cloud|$DEPLOYMENT_DIR|g" "/etc/vps-pk-cloud/ecosystem.config.js"
    sed -i "s|/var/log/vps-pk-cloud|$LOG_DIR|g" "/etc/vps-pk-cloud/ecosystem.config.js"
    
    # Start application with PM2
    pm2 start "/etc/vps-pk-cloud/ecosystem.config.js"
    pm2 save
    pm2 startup systemd -u "$SERVICE_USER" --hp "$DEPLOYMENT_DIR"
    
    log "PM2 setup completed"
}

# Configure Nginx
setup_nginx() {
    log "Setting up Nginx reverse proxy..."
    
    # Create Nginx configuration
    cat > /etc/nginx/sites-available/vps-pk-cloud << EOF
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;
    
    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/vps-pk-cloud /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    nginx -t
    
    # Reload Nginx
    systemctl reload nginx
    systemctl enable nginx
    
    log "Nginx configuration completed"
}

# Setup SSL (Let's Encrypt)
setup_ssl() {
    if [[ -n "$DOMAIN_NAME" ]]; then
        log "Setting up SSL certificate for domain: $DOMAIN_NAME"
        
        # Install certbot
        if ! command -v certbot &> /dev/null; then
            apt-get update
            apt-get install -y certbot python3-certbot-nginx
        fi
        
        # Obtain certificate
        certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos --email "admin@$DOMAIN_NAME"
        
        # Setup auto-renewal
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        
        log "SSL certificate setup completed"
    else
        warn "No domain name provided, skipping SSL setup"
    fi
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring and logging..."
    
    # Create logrotate configuration
    cat > /etc/logrotate.d/vps-pk-cloud << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $SERVICE_USER $SERVICE_GROUP
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
    
    # Setup systemd service for monitoring
    cat > /etc/systemd/system/vps-pk-monitor.service << EOF
[Unit]
Description=VPS-PK Cloud Platform Monitor
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$DEPLOYMENT_DIR
ExecStart=/usr/bin/node $DEPLOYMENT_DIR/monitoring/vpspk-monitor.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    
    # Enable and start monitoring service
    systemctl daemon-reload
    systemctl enable vps-pk-monitor
    systemctl start vps-pk-monitor
    
    log "Monitoring setup completed"
}

# Setup backup system
setup_backup() {
    log "Setting up backup system..."
    
    # Create backup script
    cat > /usr/local/bin/vps-pk-backup << EOF
#!/bin/bash
cd $DEPLOYMENT_DIR
./backup-recovery/backup-system.sh full
EOF
    
    chmod +x /usr/local/bin/vps-pk-backup
    
    # Setup daily backups
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/vps-pk-backup") | crontab -
    
    log "Backup system setup completed"
}

# Run final tests
run_final_tests() {
    log "Running final production tests..."
    
    cd "$DEPLOYMENT_DIR"
    
    # Wait for application to start
    sleep 10
    
    # Test health endpoint
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log "Health check passed"
    else
        error "Health check failed"
    fi
    
    # Test API endpoint
    if curl -f -H "X-API-Key: test-key-123" http://localhost:3000/api/v1/compute/zephyrcore/instances > /dev/null 2>&1; then
        log "API test passed"
    else
        error "API test failed"
    fi
    
    # Test Nginx proxy
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log "Nginx proxy test passed"
    else
        error "Nginx proxy test failed"
    fi
    
    log "All final tests passed"
}

# Create management scripts
create_management_scripts() {
    log "Creating management scripts..."
    
    # Start script
    cat > /usr/local/bin/vps-pk-start << EOF
#!/bin/bash
pm2 start /etc/vps-pk-cloud/ecosystem.config.js
systemctl start vps-pk-monitor
systemctl start nginx
echo "VPS-PK Cloud Platform started"
EOF
    
    # Stop script
    cat > /usr/local/bin/vps-pk-stop << EOF
#!/bin/bash
pm2 stop vps-pk-cloud
systemctl stop vps-pk-monitor
systemctl stop nginx
echo "VPS-PK Cloud Platform stopped"
EOF
    
    # Restart script
    cat > /usr/local/bin/vps-pk-restart << EOF
#!/bin/bash
pm2 restart vps-pk-cloud
systemctl restart vps-pk-monitor
systemctl reload nginx
echo "VPS-PK Cloud Platform restarted"
EOF
    
    # Status script
    cat > /usr/local/bin/vps-pk-status << EOF
#!/bin/bash
echo "=== VPS-PK Cloud Platform Status ==="
echo "PM2 Status:"
pm2 status
echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager
echo ""
echo "Monitor Status:"
systemctl status vps-pk-monitor --no-pager
echo ""
echo "Application Health:"
curl -s http://localhost/health | jq .
EOF
    
    # Logs script
    cat > /usr/local/bin/vps-pk-logs << EOF
#!/bin/bash
pm2 logs vps-pk-cloud --lines 100
EOF
    
    # Make scripts executable
    chmod +x /usr/local/bin/vps-pk-*
    
    log "Management scripts created"
}

# Generate deployment report
generate_report() {
    log "Generating deployment report..."
    
    REPORT_FILE="/var/log/vps-pk-cloud/deployment-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$REPORT_FILE" << EOF
VPS-PK Cloud Platform Deployment Report
=======================================
Deployment Date: $(date)
Version: $VERSION
Platform: $(uname -a)

Installation Details:
- Installation Directory: $DEPLOYMENT_DIR
- Service User: $SERVICE_USER
- Log Directory: $LOG_DIR
- Backup Directory: $BACKUP_DIR

Services Status:
- PM2: $(pm2 status | grep vps-pk-cloud | awk '{print $10}')
- Nginx: $(systemctl is-active nginx)
- Monitor: $(systemctl is-active vps-pk-monitor)

Network Configuration:
- Application Port: 3000
- Nginx Port: 80
- SSL: $([ -n "$DOMAIN_NAME" ] && echo "Enabled for $DOMAIN_NAME" || echo "Not configured")

Management Commands:
- Start: vps-pk-start
- Stop: vps-pk-stop
- Restart: vps-pk-restart
- Status: vps-pk-status
- Logs: vps-pk-logs
- Backup: vps-pk-backup

Health Check URLs:
- Application: http://localhost:3000/health
- Nginx Proxy: http://localhost/health
- API Documentation: http://localhost/docs

Next Steps:
1. Configure domain name and SSL certificate
2. Set up monitoring alerts
3. Configure backup retention policies
4. Review security settings
5. Test all services thoroughly

Support:
- Documentation: $DEPLOYMENT_DIR/PRODUCTION-DOCUMENTATION.md
- Logs: $LOG_DIR/
- Configuration: /etc/vps-pk-cloud/
EOF
    
    log "Deployment report generated: $REPORT_FILE"
}

# Main deployment function
main() {
    log "Starting VPS-PK Cloud Platform Production Deployment"
    log "Version: $VERSION"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN_NAME="$2"
                shift 2
                ;;
            --skip-ssl)
                SKIP_SSL=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--domain DOMAIN_NAME] [--skip-ssl]"
                echo "  --domain: Domain name for SSL certificate"
                echo "  --skip-ssl: Skip SSL certificate setup"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Run deployment steps
    check_root
    check_requirements
    setup_system
    install_application
    setup_pm2
    setup_nginx
    
    if [[ -n "$DOMAIN_NAME" && "$SKIP_SSL" != "true" ]]; then
        setup_ssl
    fi
    
    setup_monitoring
    setup_backup
    create_management_scripts
    run_final_tests
    generate_report
    
    log "VPS-PK Cloud Platform deployment completed successfully!"
    log "Platform is now running and accessible at:"
    log "  - Application: http://localhost:3000"
    log "  - Nginx Proxy: http://localhost"
    if [[ -n "$DOMAIN_NAME" ]]; then
        log "  - Domain: https://$DOMAIN_NAME"
    fi
    log ""
    log "Management commands available:"
    log "  - vps-pk-status    # Check platform status"
    log "  - vps-pk-logs      # View application logs"
    log "  - vps-pk-restart   # Restart platform"
    log "  - vps-pk-backup    # Run backup"
    log ""
    log "Deployment report saved to: /var/log/vps-pk-cloud/deployment-report-*.txt"
}

# Run main function
main "$@"
