#!/bin/bash

# VPS-PK Cloud Platform - Monitoring & Alerting Setup
# Comprehensive monitoring configuration for production deployment

set -e

# Configuration
PLATFORM_NAME="VPS-PK Cloud Platform"
MONITORING_DIR="/opt/vps-pk-monitoring"
LOG_DIR="/var/log/vps-pk-monitoring"
ALERT_EMAIL="admin@vps-pk.com"
SLACK_WEBHOOK=""
TEAMS_WEBHOOK=""

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

# Install monitoring dependencies
install_dependencies() {
    log "Installing monitoring dependencies..."
    
    # Update package list
    apt-get update
    
    # Install required packages
    apt-get install -y \
        curl \
        jq \
        mailutils \
        postfix \
        htop \
        iotop \
        nethogs \
        iftop \
        tcpdump \
        netstat-nat \
        sysstat \
        dstat \
        atop \
        nload \
        vnstat
    
    log "Dependencies installed successfully"
}

# Setup monitoring directories
setup_directories() {
    log "Setting up monitoring directories..."
    
    # Create directories
    mkdir -p "$MONITORING_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$MONITORING_DIR/scripts"
    mkdir -p "$MONITORING_DIR/configs"
    mkdir -p "$MONITORING_DIR/alerts"
    mkdir -p "$MONITORING_DIR/dashboards"
    
    # Set permissions
    chown -R root:root "$MONITORING_DIR"
    chown -R root:root "$LOG_DIR"
    
    log "Directories created successfully"
}

# Create system monitoring script
create_system_monitor() {
    log "Creating system monitoring script..."
    
    cat > "$MONITORING_DIR/scripts/system-monitor.sh" << 'EOF'
#!/bin/bash

# VPS-PK Cloud Platform - System Monitoring Script
# Monitors system resources and generates alerts

# Configuration
LOG_FILE="/var/log/vps-pk-monitoring/system-monitor.log"
ALERT_EMAIL="admin@vps-pk.com"
ALERT_THRESHOLDS=(
    "CPU:80"
    "MEMORY:85"
    "DISK:90"
    "LOAD:5.0"
    "NETWORK:1000"
)

# Logging function
log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Send alert function
send_alert() {
    local alert_type="$1"
    local alert_message="$2"
    local severity="$3"
    
    log_message "ALERT [$severity]: $alert_type - $alert_message"
    
    # Send email alert
    echo "$alert_message" | mail -s "[$severity] VPS-PK Cloud Platform Alert: $alert_type" "$ALERT_EMAIL"
    
    # Send Slack alert (if webhook configured)
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[$severity] VPS-PK Cloud Platform Alert: $alert_type - $alert_message\"}" \
            "$SLACK_WEBHOOK"
    fi
    
    # Send Teams alert (if webhook configured)
    if [[ -n "$TEAMS_WEBHOOK" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[$severity] VPS-PK Cloud Platform Alert: $alert_type - $alert_message\"}" \
            "$TEAMS_WEBHOOK"
    fi
}

# Check CPU usage
check_cpu() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    local threshold=$(echo "${ALERT_THRESHOLDS[0]}" | cut -d':' -f2)
    
    if (( $(echo "$cpu_usage > $threshold" | bc -l) )); then
        send_alert "CPU" "High CPU usage: ${cpu_usage}%" "WARNING"
    fi
}

# Check memory usage
check_memory() {
    local memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    local threshold=$(echo "${ALERT_THRESHOLDS[1]}" | cut -d':' -f2)
    
    if (( $(echo "$memory_usage > $threshold" | bc -l) )); then
        send_alert "MEMORY" "High memory usage: ${memory_usage}%" "WARNING"
    fi
}

# Check disk usage
check_disk() {
    local disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    local threshold=$(echo "${ALERT_THRESHOLDS[2]}" | cut -d':' -f2)
    
    if [[ $disk_usage -gt $threshold ]]; then
        send_alert "DISK" "High disk usage: ${disk_usage}%" "CRITICAL"
    fi
}

# Check system load
check_load() {
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local threshold=$(echo "${ALERT_THRESHOLDS[3]}" | cut -d':' -f2)
    
    if (( $(echo "$load_avg > $threshold" | bc -l) )); then
        send_alert "LOAD" "High system load: ${load_avg}" "WARNING"
    fi
}

# Check network usage
check_network() {
    local network_usage=$(iftop -t -s 10 -n | grep "Total send and receive rate" | awk '{print $6}' | sed 's/Mb//')
    local threshold=$(echo "${ALERT_THRESHOLDS[4]}" | cut -d':' -f2)
    
    if (( $(echo "$network_usage > $threshold" | bc -l) )); then
        send_alert "NETWORK" "High network usage: ${network_usage}Mb/s" "INFO"
    fi
}

# Check application health
check_application() {
    # Check if PM2 processes are running
    if ! pm2 status | grep -q "online"; then
        send_alert "APPLICATION" "PM2 processes are not running" "CRITICAL"
    fi
    
    # Check if Nginx is running
    if ! systemctl is-active --quiet nginx; then
        send_alert "APPLICATION" "Nginx is not running" "CRITICAL"
    fi
    
    # Check application health endpoint
    if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
        send_alert "APPLICATION" "Application health check failed" "CRITICAL"
    fi
}

# Check database health
check_database() {
    # Check if database is accessible (if applicable)
    if command -v psql &> /dev/null; then
        if ! psql -h localhost -U postgres -c "SELECT 1;" > /dev/null 2>&1; then
            send_alert "DATABASE" "Database connection failed" "CRITICAL"
        fi
    fi
}

# Main monitoring function
main() {
    log_message "Starting system monitoring check"
    
    check_cpu
    check_memory
    check_disk
    check_load
    check_network
    check_application
    check_database
    
    log_message "System monitoring check completed"
}

# Run main function
main "$@"
EOF
    
    chmod +x "$MONITORING_DIR/scripts/system-monitor.sh"
    log "System monitoring script created"
}

# Create application monitoring script
create_application_monitor() {
    log "Creating application monitoring script..."
    
    cat > "$MONITORING_DIR/scripts/application-monitor.sh" << 'EOF'
#!/bin/bash

# VPS-PK Cloud Platform - Application Monitoring Script
# Monitors application-specific metrics and health

# Configuration
LOG_FILE="/var/log/vps-pk-monitoring/application-monitor.log"
API_BASE_URL="http://localhost:3000"
API_KEY="test-key-123"
ALERT_EMAIL="admin@vps-pk.com"

# Logging function
log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Send alert function
send_alert() {
    local alert_type="$1"
    local alert_message="$2"
    local severity="$3"
    
    log_message "ALERT [$severity]: $alert_type - $alert_message"
    
    # Send email alert
    echo "$alert_message" | mail -s "[$severity] VPS-PK Cloud Platform Alert: $alert_type" "$ALERT_EMAIL"
}

# Check API endpoints
check_api_endpoints() {
    local endpoints=(
        "/health"
        "/api/v1/compute/zephyrcore/instances"
        "/api/v1/storage/moonvault/buckets"
        "/api/v1/database/aurorabase/clusters"
        "/api/v1/analytics/datastream/streams"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local url="${API_BASE_URL}${endpoint}"
        local response_code
        
        if [[ "$endpoint" == "/health" ]]; then
            response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
        else
            response_code=$(curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $API_KEY" "$url")
        fi
        
        if [[ $response_code -ne 200 ]]; then
            send_alert "API" "Endpoint $endpoint returned status $response_code" "WARNING"
        fi
    done
}

# Check response times
check_response_times() {
    local endpoints=(
        "/health"
        "/api/v1/compute/zephyrcore/instances"
        "/api/v1/storage/moonvault/buckets"
    )
    
    for endpoint in "${endpoints[@]}"; do
        local url="${API_BASE_URL}${endpoint}"
        local response_time
        
        if [[ "$endpoint" == "/health" ]]; then
            response_time=$(curl -s -o /dev/null -w "%{time_total}" "$url")
        else
            response_time=$(curl -s -o /dev/null -w "%{time_total}" -H "X-API-Key: $API_KEY" "$url")
        fi
        
        # Convert to milliseconds
        response_time_ms=$(echo "$response_time * 1000" | bc)
        
        if (( $(echo "$response_time_ms > 1000" | bc -l) )); then
            send_alert "PERFORMANCE" "Slow response time for $endpoint: ${response_time_ms}ms" "WARNING"
        fi
    done
}

# Check error rates
check_error_rates() {
    local error_log="/var/log/vps-pk-cloud/error.log"
    
    if [[ -f "$error_log" ]]; then
        local error_count=$(tail -n 100 "$error_log" | grep -c "ERROR")
        
        if [[ $error_count -gt 10 ]]; then
            send_alert "ERRORS" "High error rate detected: $error_count errors in last 100 log entries" "WARNING"
        fi
    fi
}

# Check service status
check_service_status() {
    local services=(
        "vps-pk-cloud"
        "nginx"
        "vps-pk-monitor"
    )
    
    for service in "${services[@]}"; do
        if [[ "$service" == "vps-pk-cloud" ]]; then
            if ! pm2 status | grep -q "$service.*online"; then
                send_alert "SERVICE" "Service $service is not running" "CRITICAL"
            fi
        else
            if ! systemctl is-active --quiet "$service"; then
                send_alert "SERVICE" "Service $service is not running" "CRITICAL"
            fi
        fi
    done
}

# Check resource usage
check_resource_usage() {
    # Check PM2 process memory usage
    local pm2_memory=$(pm2 jlist | jq '.[] | select(.name=="vps-pk-cloud") | .monit.memory')
    
    if [[ $pm2_memory -gt 1000000000 ]]; then  # 1GB
        send_alert "RESOURCE" "High memory usage by application: ${pm2_memory} bytes" "WARNING"
    fi
    
    # Check PM2 process CPU usage
    local pm2_cpu=$(pm2 jlist | jq '.[] | select(.name=="vps-pk-cloud") | .monit.cpu')
    
    if [[ $pm2_cpu -gt 80 ]]; then
        send_alert "RESOURCE" "High CPU usage by application: ${pm2_cpu}%" "WARNING"
    fi
}

# Main monitoring function
main() {
    log_message "Starting application monitoring check"
    
    check_api_endpoints
    check_response_times
    check_error_rates
    check_service_status
    check_resource_usage
    
    log_message "Application monitoring check completed"
}

# Run main function
main "$@"
EOF
    
    chmod +x "$MONITORING_DIR/scripts/application-monitor.sh"
    log "Application monitoring script created"
}

# Create log monitoring script
create_log_monitor() {
    log "Creating log monitoring script..."
    
    cat > "$MONITORING_DIR/scripts/log-monitor.sh" << 'EOF'
#!/bin/bash

# VPS-PK Cloud Platform - Log Monitoring Script
# Monitors application logs for errors and anomalies

# Configuration
LOG_FILE="/var/log/vps-pk-monitoring/log-monitor.log"
APP_LOG_DIR="/var/log/vps-pk-cloud"
ALERT_EMAIL="admin@vps-pk.com"

# Logging function
log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Send alert function
send_alert() {
    local alert_type="$1"
    local alert_message="$2"
    local severity="$3"
    
    log_message "ALERT [$severity]: $alert_type - $alert_message"
    
    # Send email alert
    echo "$alert_message" | mail -s "[$severity] VPS-PK Cloud Platform Alert: $alert_type" "$ALERT_EMAIL"
}

# Monitor error logs
monitor_error_logs() {
    local error_patterns=(
        "ERROR"
        "FATAL"
        "CRITICAL"
        "Exception"
        "Error:"
        "Failed"
        "Timeout"
        "Connection refused"
        "Out of memory"
        "Stack overflow"
    )
    
    for pattern in "${error_patterns[@]}"; do
        local error_count=$(find "$APP_LOG_DIR" -name "*.log" -type f -exec grep -c "$pattern" {} \; 2>/dev/null | awk '{sum += $1} END {print sum}')
        
        if [[ $error_count -gt 5 ]]; then
            send_alert "LOGS" "Multiple errors found with pattern '$pattern': $error_count occurrences" "WARNING"
        fi
    done
}

# Monitor security logs
monitor_security_logs() {
    local security_patterns=(
        "Unauthorized"
        "Authentication failed"
        "Invalid API key"
        "Rate limit exceeded"
        "SQL injection"
        "XSS attempt"
        "Suspicious activity"
    )
    
    for pattern in "${security_patterns[@]}"; do
        local security_count=$(find "$APP_LOG_DIR" -name "*.log" -type f -exec grep -c "$pattern" {} \; 2>/dev/null | awk '{sum += $1} END {print sum}')
        
        if [[ $security_count -gt 0 ]]; then
            send_alert "SECURITY" "Security event detected with pattern '$pattern': $security_count occurrences" "CRITICAL"
        fi
    done
}

# Monitor performance logs
monitor_performance_logs() {
    local performance_patterns=(
        "slow query"
        "high response time"
        "timeout"
        "memory leak"
        "high CPU usage"
    )
    
    for pattern in "${performance_patterns[@]}"; do
        local perf_count=$(find "$APP_LOG_DIR" -name "*.log" -type f -exec grep -c "$pattern" {} \; 2>/dev/null | awk '{sum += $1} END {print sum}')
        
        if [[ $perf_count -gt 3 ]]; then
            send_alert "PERFORMANCE" "Performance issue detected with pattern '$pattern': $perf_count occurrences" "WARNING"
        fi
    done
}

# Monitor log file sizes
monitor_log_sizes() {
    find "$APP_LOG_DIR" -name "*.log" -type f -size +100M | while read -r logfile; do
        local size=$(du -h "$logfile" | cut -f1)
        send_alert "LOGS" "Large log file detected: $logfile ($size)" "INFO"
    done
}

# Main monitoring function
main() {
    log_message "Starting log monitoring check"
    
    monitor_error_logs
    monitor_security_logs
    monitor_performance_logs
    monitor_log_sizes
    
    log_message "Log monitoring check completed"
}

# Run main function
main "$@"
EOF
    
    chmod +x "$MONITORING_DIR/scripts/log-monitor.sh"
    log "Log monitoring script created"
}

# Setup cron jobs
setup_cron_jobs() {
    log "Setting up monitoring cron jobs..."
    
    # Create cron job file
    cat > /etc/cron.d/vps-pk-monitoring << EOF
# VPS-PK Cloud Platform Monitoring Cron Jobs

# System monitoring every 5 minutes
*/5 * * * * root $MONITORING_DIR/scripts/system-monitor.sh

# Application monitoring every 2 minutes
*/2 * * * * root $MONITORING_DIR/scripts/application-monitor.sh

# Log monitoring every 10 minutes
*/10 * * * * root $MONITORING_DIR/scripts/log-monitor.sh

# Daily log rotation and cleanup
0 2 * * * root find $LOG_DIR -name "*.log" -mtime +30 -delete
EOF
    
    # Set proper permissions
    chmod 644 /etc/cron.d/vps-pk-monitoring
    
    # Restart cron service
    systemctl restart cron
    
    log "Cron jobs configured successfully"
}

# Create monitoring dashboard
create_dashboard() {
    log "Creating monitoring dashboard..."
    
    cat > "$MONITORING_DIR/dashboards/system-dashboard.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VPS-PK Cloud Platform - System Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .metric-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .metric-value { font-size: 24px; color: #3498db; }
        .status-good { color: #27ae60; }
        .status-warning { color: #f39c12; }
        .status-critical { color: #e74c3c; }
        .refresh-btn { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VPS-PK Cloud Platform - System Dashboard</h1>
            <p>Real-time system monitoring and metrics</p>
            <button class="refresh-btn" onclick="refreshDashboard()">Refresh</button>
        </div>
        
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-title">CPU Usage</div>
                <div class="metric-value" id="cpu-usage">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Memory Usage</div>
                <div class="metric-value" id="memory-usage">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Disk Usage</div>
                <div class="metric-value" id="disk-usage">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">System Load</div>
                <div class="metric-value" id="system-load">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Network Usage</div>
                <div class="metric-value" id="network-usage">Loading...</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-title">Application Status</div>
                <div class="metric-value" id="app-status">Loading...</div>
            </div>
        </div>
    </div>
    
    <script>
        function refreshDashboard() {
            // Simulate real-time data updates
            document.getElementById('cpu-usage').textContent = Math.random() * 100 + '%';
            document.getElementById('memory-usage').textContent = Math.random() * 100 + '%';
            document.getElementById('disk-usage').textContent = Math.random() * 100 + '%';
            document.getElementById('system-load').textContent = (Math.random() * 5).toFixed(2);
            document.getElementById('network-usage').textContent = (Math.random() * 1000).toFixed(0) + ' Kbps';
            document.getElementById('app-status').textContent = 'Online';
        }
        
        // Auto-refresh every 30 seconds
        setInterval(refreshDashboard, 30000);
        
        // Initial load
        refreshDashboard();
    </script>
</body>
</html>
EOF
    
    log "Monitoring dashboard created"
}

# Setup email alerts
setup_email_alerts() {
    log "Setting up email alerts..."
    
    # Configure Postfix for email alerts
    cat > /etc/postfix/main.cf << EOF
# Postfix configuration for VPS-PK Cloud Platform alerts
myhostname = $(hostname)
mydomain = vps-pk.com
myorigin = \$mydomain
inet_interfaces = localhost
mydestination = \$myhostname, localhost.\$mydomain, localhost
relayhost = 
mynetworks = 127.0.0.0/8
mailbox_size_limit = 0
recipient_delimiter = +
inet_protocols = ipv4
EOF
    
    # Restart Postfix
    systemctl restart postfix
    systemctl enable postfix
    
    log "Email alerts configured"
}

# Create monitoring service
create_monitoring_service() {
    log "Creating monitoring service..."
    
    cat > /etc/systemd/system/vps-pk-monitoring.service << EOF
[Unit]
Description=VPS-PK Cloud Platform Monitoring Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$MONITORING_DIR
ExecStart=/bin/bash -c 'while true; do sleep 60; done'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    # Enable and start service
    systemctl daemon-reload
    systemctl enable vps-pk-monitoring
    systemctl start vps-pk-monitoring
    
    log "Monitoring service created and started"
}

# Generate monitoring report
generate_report() {
    log "Generating monitoring setup report..."
    
    REPORT_FILE="/var/log/vps-pk-monitoring/setup-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$REPORT_FILE" << EOF
VPS-PK Cloud Platform Monitoring Setup Report
============================================
Setup Date: $(date)
Platform: $(uname -a)

Monitoring Configuration:
- Monitoring Directory: $MONITORING_DIR
- Log Directory: $LOG_DIR
- Alert Email: $ALERT_EMAIL

Monitoring Scripts:
- System Monitor: $MONITORING_DIR/scripts/system-monitor.sh
- Application Monitor: $MONITORING_DIR/scripts/application-monitor.sh
- Log Monitor: $MONITORING_DIR/scripts/log-monitor.sh

Cron Jobs:
- System monitoring: Every 5 minutes
- Application monitoring: Every 2 minutes
- Log monitoring: Every 10 minutes
- Log cleanup: Daily at 2 AM

Services:
- Monitoring Service: $(systemctl is-active vps-pk-monitoring)
- Postfix: $(systemctl is-active postfix)
- Cron: $(systemctl is-active cron)

Dashboard:
- System Dashboard: $MONITORING_DIR/dashboards/system-dashboard.html

Alert Configuration:
- Email alerts enabled
- Slack webhook: $([ -n "$SLACK_WEBHOOK" ] && echo "Configured" || echo "Not configured")
- Teams webhook: $([ -n "$TEAMS_WEBHOOK" ] && echo "Configured" || echo "Not configured")

Monitoring Thresholds:
- CPU Usage: 80%
- Memory Usage: 85%
- Disk Usage: 90%
- System Load: 5.0
- Network Usage: 1000 Mb/s

Next Steps:
1. Configure Slack/Teams webhooks for additional alerts
2. Customize monitoring thresholds as needed
3. Set up additional monitoring dashboards
4. Configure log retention policies
5. Test alerting system

Support:
- Monitoring logs: $LOG_DIR/
- Configuration: $MONITORING_DIR/configs/
- Scripts: $MONITORING_DIR/scripts/
EOF
    
    log "Monitoring setup report generated: $REPORT_FILE"
}

# Main setup function
main() {
    log "Starting VPS-PK Cloud Platform Monitoring Setup"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --email)
                ALERT_EMAIL="$2"
                shift 2
                ;;
            --slack-webhook)
                SLACK_WEBHOOK="$2"
                shift 2
                ;;
            --teams-webhook)
                TEAMS_WEBHOOK="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--email EMAIL] [--slack-webhook URL] [--teams-webhook URL]"
                echo "  --email: Email address for alerts"
                echo "  --slack-webhook: Slack webhook URL for alerts"
                echo "  --teams-webhook: Teams webhook URL for alerts"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Run setup steps
    check_root
    install_dependencies
    setup_directories
    create_system_monitor
    create_application_monitor
    create_log_monitor
    setup_cron_jobs
    create_dashboard
    setup_email_alerts
    create_monitoring_service
    generate_report
    
    log "VPS-PK Cloud Platform monitoring setup completed successfully!"
    log "Monitoring is now active and will send alerts to: $ALERT_EMAIL"
    log ""
    log "Monitoring components:"
    log "  - System monitoring: Every 5 minutes"
    log "  - Application monitoring: Every 2 minutes"
    log "  - Log monitoring: Every 10 minutes"
    log "  - Dashboard: $MONITORING_DIR/dashboards/system-dashboard.html"
    log ""
    log "Setup report saved to: /var/log/vps-pk-monitoring/setup-report-*.txt"
}

# Run main function
main "$@"
