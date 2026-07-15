#!/bin/bash

# VPS-PK Cloud Platform - Production Deployment Script
# Comprehensive deployment script for production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PLATFORM_NAME="VPS-PK Cloud Platform"
VERSION="1.0.0"
NODE_VERSION="18.0.0"
PM2_VERSION="5.3.0"
NGINX_VERSION="1.20.0"

# Production settings
PRODUCTION_PORT=80
API_PORT=3000
SSL_ENABLED=true
MONITORING_ENABLED=true
BACKUP_ENABLED=true

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  $PLATFORM_NAME - Production Deployment${NC}"
echo -e "${BLUE}  Version: $VERSION${NC}"
echo -e "${BLUE}========================================${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_warning "Running as root. Consider using a non-root user for security."
    fi
}

# Check system requirements
check_system() {
    print_status "Checking system requirements..."
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_status "Linux system detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        print_status "macOS system detected"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    # Check memory
    MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$MEMORY_GB" -lt 2 ]; then
        print_warning "Low memory detected ($MEMORY_GB GB). Recommended: 4GB+"
    else
        print_status "Memory check passed ($MEMORY_GB GB)"
    fi
    
    # Check disk space
    DISK_GB=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$DISK_GB" -lt 10 ]; then
        print_error "Insufficient disk space ($DISK_GB GB). Required: 10GB+"
        exit 1
    else
        print_status "Disk space check passed ($DISK_GB GB available)"
    fi
}

# Install Node.js
install_nodejs() {
    print_status "Installing Node.js $NODE_VERSION..."
    
    if command -v node &> /dev/null; then
        CURRENT_VERSION=$(node --version | sed 's/v//')
        print_status "Node.js already installed (version $CURRENT_VERSION)"
        
        if [[ $(echo "$CURRENT_VERSION $NODE_VERSION" | awk '{print ($1 >= $2)}') == 1 ]]; then
            print_status "Node.js version is compatible"
            return
        fi
    fi
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    print_status "Node.js installation completed"
}

# Install PM2 for process management
install_pm2() {
    print_status "Installing PM2 process manager..."
    
    if command -v pm2 &> /dev/null; then
        print_status "PM2 already installed"
        return
    fi
    
    sudo npm install -g pm2@$PM2_VERSION
    print_status "PM2 installation completed"
}

# Install Nginx for reverse proxy
install_nginx() {
    print_status "Installing Nginx reverse proxy..."
    
    if command -v nginx &> /dev/null; then
        print_status "Nginx already installed"
        return
    fi
    
    sudo apt-get update
    sudo apt-get install -y nginx
    
    # Start and enable Nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    print_status "Nginx installation completed"
}

# Install SSL certificates
install_ssl() {
    if [ "$SSL_ENABLED" = true ]; then
        print_status "Installing SSL certificates..."
        
        # Install Certbot for Let's Encrypt
        sudo apt-get install -y certbot python3-certbot-nginx
        
        print_warning "SSL certificates will be configured after domain setup"
        print_status "Run: sudo certbot --nginx -d yourdomain.com"
    fi
}

# Install monitoring tools
install_monitoring() {
    if [ "$MONITORING_ENABLED" = true ]; then
        print_status "Installing monitoring tools..."
        
        # Install htop for system monitoring
        sudo apt-get install -y htop
        
        # Install netstat for network monitoring
        sudo apt-get install -y net-tools
        
        print_status "Monitoring tools installed"
    fi
}

# Setup production environment
setup_production() {
    print_status "Setting up production environment..."
    
    # Create production directory
    sudo mkdir -p /opt/vps-pk-cloud
    sudo chown $USER:$USER /opt/vps-pk-cloud
    
    # Copy application files
    cp -r . /opt/vps-pk-cloud/
    cd /opt/vps-pk-cloud
    
    # Install dependencies
    print_status "Installing production dependencies..."
    npm install --production
    
    # Create logs directory
    mkdir -p logs
    
    # Create backup directory
    if [ "$BACKUP_ENABLED" = true ]; then
        mkdir -p backups
    fi
    
    print_status "Production environment setup completed"
}

# Configure Nginx
configure_nginx() {
    print_status "Configuring Nginx reverse proxy..."
    
    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/vps-pk-cloud > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    
    # Main application
    location / {
        proxy_pass http://localhost:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }
    
    # Static files
    location /static/ {
        alias /opt/vps-pk-cloud/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:$API_PORT/health;
        access_log off;
    }
}
EOF
    
    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/vps-pk-cloud /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    sudo nginx -t
    
    # Reload Nginx
    sudo systemctl reload nginx
    
    print_status "Nginx configuration completed"
}

# Configure PM2
configure_pm2() {
    print_status "Configuring PM2 process manager..."
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'vps-pk-cloud',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: $API_PORT
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF
    
    # Start application with PM2
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    
    print_status "PM2 configuration completed"
}

# Setup monitoring
setup_monitoring() {
    if [ "$MONITORING_ENABLED" = true ]; then
        print_status "Setting up monitoring..."
        
        # Create monitoring script
        cat > monitor.sh <<'EOF'
#!/bin/bash

# VPS-PK Cloud Platform Monitoring Script

LOG_FILE="/opt/vps-pk-cloud/logs/monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting monitoring check..." >> $LOG_FILE

# Check PM2 processes
pm2 status >> $LOG_FILE 2>&1

# Check Nginx status
systemctl is-active nginx >> $LOG_FILE 2>&1

# Check disk space
df -h >> $LOG_FILE 2>&1

# Check memory usage
free -h >> $LOG_FILE 2>&1

# Check API health
curl -s http://localhost:3000/health >> $LOG_FILE 2>&1

echo "[$DATE] Monitoring check completed" >> $LOG_FILE
EOF
        
        chmod +x monitor.sh
        
        # Add to crontab for regular monitoring
        (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/vps-pk-cloud/monitor.sh") | crontab -
        
        print_status "Monitoring setup completed"
    fi
}

# Setup backup
setup_backup() {
    if [ "$BACKUP_ENABLED" = true ]; then
        print_status "Setting up backup system..."
        
        # Create backup script
        cat > backup.sh <<'EOF'
#!/bin/bash

# VPS-PK Cloud Platform Backup Script

BACKUP_DIR="/opt/vps-pk-cloud/backups"
DATE=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="vps-pk-cloud-backup-$DATE.tar.gz"

echo "Creating backup: $BACKUP_FILE"

# Create backup
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
    --exclude=node_modules \
    --exclude=logs \
    --exclude=backups \
    /opt/vps-pk-cloud

# Keep only last 7 days of backups
find $BACKUP_DIR -name "vps-pk-cloud-backup-*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF
        
        chmod +x backup.sh
        
        # Add to crontab for daily backups
        (crontab -l 2>/dev/null; echo "0 2 * * * /opt/vps-pk-cloud/backup.sh") | crontab -
        
        print_status "Backup system setup completed"
    fi
}

# Create systemd service
create_systemd_service() {
    print_status "Creating systemd service..."
    
    sudo tee /etc/systemd/system/vps-pk-cloud.service > /dev/null <<EOF
[Unit]
Description=VPS-PK Cloud Platform
After=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=/opt/vps-pk-cloud
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 stop all
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable vps-pk-cloud
    
    print_status "Systemd service created"
}

# Final verification
verify_installation() {
    print_status "Verifying installation..."
    
    # Check if services are running
    if systemctl is-active --quiet nginx; then
        print_status "✓ Nginx is running"
    else
        print_error "✗ Nginx is not running"
    fi
    
    if pm2 list | grep -q "vps-pk-cloud"; then
        print_status "✓ VPS-PK Cloud application is running"
    else
        print_error "✗ VPS-PK Cloud application is not running"
    fi
    
    # Test API endpoint
    if curl -s http://localhost:$API_PORT/health | grep -q "healthy"; then
        print_status "✓ API health check passed"
    else
        print_error "✗ API health check failed"
    fi
    
    print_status "Installation verification completed"
}

# Main deployment function
main() {
    print_status "Starting VPS-PK Cloud Platform production deployment..."
    
    check_root
    check_system
    install_nodejs
    install_pm2
    install_nginx
    install_ssl
    install_monitoring
    setup_production
    configure_nginx
    configure_pm2
    setup_monitoring
    setup_backup
    create_systemd_service
    verify_installation
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  DEPLOYMENT COMPLETED SUCCESSFULLY!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Platform Access:${NC}"
    echo -e "  Web Interface: http://$(curl -s ifconfig.me)"
    echo -e "  API Endpoint: http://$(curl -s ifconfig.me)/api/v1"
    echo -e "  Health Check: http://$(curl -s ifconfig.me)/health"
    echo -e "  Documentation: http://$(curl -s ifconfig.me)/docs"
    echo ""
    echo -e "${BLUE}Management Commands:${NC}"
    echo -e "  PM2 Status: pm2 status"
    echo -e "  PM2 Logs: pm2 logs"
    echo -e "  Restart App: pm2 restart vps-pk-cloud"
    echo -e "  Nginx Status: sudo systemctl status nginx"
    echo -e "  Monitor Logs: tail -f /opt/vps-pk-cloud/logs/monitor.log"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "  1. Configure SSL certificates: sudo certbot --nginx -d yourdomain.com"
    echo -e "  2. Update DNS records to point to this server"
    echo -e "  3. Configure firewall: sudo ufw allow 80,443/tcp"
    echo -e "  4. Set up monitoring alerts"
    echo -e "  5. Test all API endpoints"
    echo ""
    print_status "VPS-PK Cloud Platform is now live and ready for production!"
}

# Run main function
main "$@"
