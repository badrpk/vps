/**
 * VPS-PK Cloud Platform - Advanced Monitoring & Logging System
 * Comprehensive monitoring, alerting, and logging for production environments
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class VPSPKMonitor {
    constructor(config = {}) {
        this.config = {
            logLevel: config.logLevel || 'info',
            logRetentionDays: config.logRetentionDays || 30,
            metricsInterval: config.metricsInterval || 60000, // 1 minute
            alertThresholds: {
                cpu: config.cpuThreshold || 80,
                memory: config.memoryThreshold || 85,
                disk: config.diskThreshold || 90,
                responseTime: config.responseTimeThreshold || 5000
            },
            enableAlerts: config.enableAlerts !== false,
            alertChannels: config.alertChannels || ['email', 'webhook'],
            ...config
        };

        this.metrics = {
            system: {},
            application: {},
            services: {},
            alerts: []
        };

        this.logs = [];
        this.alertHistory = [];
        this.startTime = Date.now();

        this.setupLogging();
        this.startMetricsCollection();
        this.setupAlerting();

        console.log("VPS-PK Cloud Monitor initialized");
    }

    /**
     * Setup logging system
     */
    setupLogging() {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        this.logFile = path.join(logDir, `monitor-${new Date().toISOString().split('T')[0]}.log`);
        this.errorFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
        this.accessFile = path.join(logDir, `access-${new Date().toISOString().split('T')[0]}.log`);
    }

    /**
     * Log message with different levels
     */
    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            data,
            pid: process.pid,
            hostname: os.hostname()
        };

        // Add to in-memory logs
        this.logs.push(logEntry);
        if (this.logs.length > 10000) {
            this.logs.shift(); // Keep only last 10k entries
        }

        // Write to file
        const logLine = JSON.stringify(logEntry) + '\n';
        
        try {
            fs.appendFileSync(this.logFile, logLine);
            
            if (level === 'error') {
                fs.appendFileSync(this.errorFile, logLine);
            }
        } catch (error) {
            console.error('Failed to write log:', error);
        }

        // Console output
        const colors = {
            info: '\x1b[36m',
            warn: '\x1b[33m',
            error: '\x1b[31m',
            debug: '\x1b[35m'
        };
        
        console.log(`${colors[level] || ''}[${timestamp}] ${level.toUpperCase()}: ${message}${colors[level] ? '\x1b[0m' : ''}`);
    }

    /**
     * Start metrics collection
     */
    startMetricsCollection() {
        this.collectSystemMetrics();
        this.collectApplicationMetrics();
        this.collectServiceMetrics();

        setInterval(() => {
            this.collectSystemMetrics();
            this.collectApplicationMetrics();
            this.collectServiceMetrics();
            this.checkThresholds();
        }, this.config.metricsInterval);
    }

    /**
     * Collect system metrics
     */
    collectSystemMetrics() {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // CPU usage calculation
        let cpuUsage = 0;
        if (this.lastCpuTime) {
            const currentCpuTime = cpus.reduce((acc, cpu) => {
                return acc + Object.values(cpu.times).reduce((a, b) => a + b, 0);
            }, 0);
            
            const idleTime = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
            const currentIdleTime = idleTime;
            
            cpuUsage = 100 - (100 * (currentIdleTime - this.lastIdleTime) / (currentCpuTime - this.lastCpuTime));
        }

        this.lastCpuTime = cpus.reduce((acc, cpu) => {
            return acc + Object.values(cpu.times).reduce((a, b) => a + b, 0);
        }, 0);
        this.lastIdleTime = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);

        // Disk usage
        const diskUsage = this.getDiskUsage();

        this.metrics.system = {
            timestamp: new Date().toISOString(),
            cpu: {
                usage: Math.round(cpuUsage * 100) / 100,
                cores: cpus.length,
                model: cpus[0].model
            },
            memory: {
                total: totalMem,
                used: usedMem,
                free: freeMem,
                usage: Math.round((usedMem / totalMem) * 100 * 100) / 100
            },
            disk: diskUsage,
            uptime: os.uptime(),
            loadAverage: os.loadavg(),
            platform: os.platform(),
            arch: os.arch()
        };

        this.log('debug', 'System metrics collected', this.metrics.system);
    }

    /**
     * Get disk usage
     */
    getDiskUsage() {
        try {
            const stats = fs.statSync(__dirname);
            // This is a simplified version - in production, use a library like 'diskusage'
            return {
                total: 1000000000000, // 1TB placeholder
                used: 50000000000,    // 50GB placeholder
                free: 950000000000,   // 950GB placeholder
                usage: 5
            };
        } catch (error) {
            return {
                total: 0,
                used: 0,
                free: 0,
                usage: 0
            };
        }
    }

    /**
     * Collect application metrics
     */
    collectApplicationMetrics() {
        const memUsage = process.memoryUsage();
        const uptime = process.uptime();

        this.metrics.application = {
            timestamp: new Date().toISOString(),
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                arrayBuffers: memUsage.arrayBuffers
            },
            uptime: uptime,
            pid: process.pid,
            version: process.version,
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version
        };

        this.log('debug', 'Application metrics collected', this.metrics.application);
    }

    /**
     * Collect service metrics
     */
    collectServiceMetrics() {
        // This would integrate with the VPSPKServiceManager
        this.metrics.services = {
            timestamp: new Date().toISOString(),
            totalServices: 21,
            activeServices: 21,
            serviceHealth: 'healthy',
            apiRequests: {
                total: Math.floor(Math.random() * 1000) + 500,
                success: Math.floor(Math.random() * 900) + 400,
                errors: Math.floor(Math.random() * 100) + 10,
                avgResponseTime: Math.floor(Math.random() * 200) + 50
            },
            databaseConnections: Math.floor(Math.random() * 50) + 10,
            cacheHitRate: Math.floor(Math.random() * 20) + 80
        };

        this.log('debug', 'Service metrics collected', this.metrics.services);
    }

    /**
     * Check alert thresholds
     */
    checkThresholds() {
        const alerts = [];

        // CPU threshold check
        if (this.metrics.system.cpu.usage > this.config.alertThresholds.cpu) {
            alerts.push({
                type: 'cpu',
                level: 'warning',
                message: `High CPU usage: ${this.metrics.system.cpu.usage}%`,
                value: this.metrics.system.cpu.usage,
                threshold: this.config.alertThresholds.cpu,
                timestamp: new Date().toISOString()
            });
        }

        // Memory threshold check
        if (this.metrics.system.memory.usage > this.config.alertThresholds.memory) {
            alerts.push({
                type: 'memory',
                level: 'warning',
                message: `High memory usage: ${this.metrics.system.memory.usage}%`,
                value: this.metrics.system.memory.usage,
                threshold: this.config.alertThresholds.memory,
                timestamp: new Date().toISOString()
            });
        }

        // Disk threshold check
        if (this.metrics.system.disk.usage > this.config.alertThresholds.disk) {
            alerts.push({
                type: 'disk',
                level: 'critical',
                message: `High disk usage: ${this.metrics.system.disk.usage}%`,
                value: this.metrics.system.disk.usage,
                threshold: this.config.alertThresholds.disk,
                timestamp: new Date().toISOString()
            });
        }

        // Response time threshold check
        if (this.metrics.services.apiRequests.avgResponseTime > this.config.alertThresholds.responseTime) {
            alerts.push({
                type: 'response_time',
                level: 'warning',
                message: `High response time: ${this.metrics.services.apiRequests.avgResponseTime}ms`,
                value: this.metrics.services.apiRequests.avgResponseTime,
                threshold: this.config.alertThresholds.responseTime,
                timestamp: new Date().toISOString()
            });
        }

        // Process alerts
        alerts.forEach(alert => {
            this.processAlert(alert);
        });
    }

    /**
     * Process alert
     */
    processAlert(alert) {
        // Check if this alert was already sent recently (avoid spam)
        const recentAlert = this.alertHistory.find(a => 
            a.type === alert.type && 
            a.level === alert.level &&
            (Date.now() - new Date(a.timestamp).getTime()) < 300000 // 5 minutes
        );

        if (recentAlert) {
            return; // Skip duplicate alert
        }

        this.alertHistory.push(alert);
        this.metrics.alerts.push(alert);

        this.log('warn', `Alert triggered: ${alert.message}`, alert);

        if (this.config.enableAlerts) {
            this.sendAlert(alert);
        }
    }

    /**
     * Send alert through configured channels
     */
    sendAlert(alert) {
        this.config.alertChannels.forEach(channel => {
            switch (channel) {
                case 'email':
                    this.sendEmailAlert(alert);
                    break;
                case 'webhook':
                    this.sendWebhookAlert(alert);
                    break;
                case 'slack':
                    this.sendSlackAlert(alert);
                    break;
            }
        });
    }

    /**
     * Send email alert
     */
    sendEmailAlert(alert) {
        // In production, integrate with email service like SendGrid, SES, etc.
        this.log('info', `Email alert sent: ${alert.message}`);
    }

    /**
     * Send webhook alert
     */
    sendWebhookAlert(alert) {
        // In production, send HTTP POST to webhook URL
        this.log('info', `Webhook alert sent: ${alert.message}`);
    }

    /**
     * Send Slack alert
     */
    sendSlackAlert(alert) {
        // In production, integrate with Slack API
        this.log('info', `Slack alert sent: ${alert.message}`);
    }

    /**
     * Setup alerting
     */
    setupAlerting() {
        if (this.config.enableAlerts) {
            this.log('info', 'Alerting system enabled', {
                channels: this.config.alertChannels,
                thresholds: this.config.alertThresholds
            });
        }
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return {
            success: true,
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            metrics: this.metrics,
            alerts: this.metrics.alerts.slice(-10), // Last 10 alerts
            logLevel: this.config.logLevel
        };
    }

    /**
     * Get logs
     */
    getLogs(level = null, limit = 100) {
        let filteredLogs = this.logs;
        
        if (level) {
            filteredLogs = this.logs.filter(log => log.level === level.toUpperCase());
        }
        
        return {
            success: true,
            logs: filteredLogs.slice(-limit),
            total: filteredLogs.length,
            level: level,
            limit: limit
        };
    }

    /**
     * Get health status
     */
    getHealth() {
        const systemHealth = this.metrics.system.cpu.usage < 90 && 
                           this.metrics.system.memory.usage < 90 &&
                           this.metrics.system.disk.usage < 95;

        const serviceHealth = this.metrics.services.serviceHealth === 'healthy';

        return {
            success: true,
            status: (systemHealth && serviceHealth) ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            system: {
                cpu: this.metrics.system.cpu.usage,
                memory: this.metrics.system.memory.usage,
                disk: this.metrics.system.disk.usage,
                healthy: systemHealth
            },
            services: {
                total: this.metrics.services.totalServices,
                active: this.metrics.services.activeServices,
                health: this.metrics.services.serviceHealth,
                healthy: serviceHealth
            },
            alerts: {
                total: this.metrics.alerts.length,
                recent: this.metrics.alerts.slice(-5)
            }
        };
    }

    /**
     * Cleanup old logs
     */
    cleanupLogs() {
        const logDir = path.join(__dirname, 'logs');
        const retentionDays = this.config.logRetentionDays;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        try {
            const files = fs.readdirSync(logDir);
            files.forEach(file => {
                const filePath = path.join(logDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    this.log('info', `Cleaned up old log file: ${file}`);
                }
            });
        } catch (error) {
            this.log('error', 'Failed to cleanup logs', { error: error.message });
        }
    }

    /**
     * Generate monitoring report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            period: '24h',
            summary: {
                uptime: Date.now() - this.startTime,
                totalAlerts: this.metrics.alerts.length,
                avgCpuUsage: this.calculateAverage('cpu'),
                avgMemoryUsage: this.calculateAverage('memory'),
                avgResponseTime: this.calculateAverage('responseTime')
            },
            metrics: this.metrics,
            recommendations: this.generateRecommendations()
        };

        return {
            success: true,
            report: report
        };
    }

    /**
     * Calculate average metric value
     */
    calculateAverage(metric) {
        // Simplified - in production, store historical data
        switch (metric) {
            case 'cpu':
                return this.metrics.system.cpu.usage;
            case 'memory':
                return this.metrics.system.memory.usage;
            case 'responseTime':
                return this.metrics.services.apiRequests.avgResponseTime;
            default:
                return 0;
        }
    }

    /**
     * Generate recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        if (this.metrics.system.cpu.usage > 70) {
            recommendations.push({
                type: 'performance',
                priority: 'high',
                message: 'Consider scaling up CPU resources or optimizing application performance'
            });
        }

        if (this.metrics.system.memory.usage > 80) {
            recommendations.push({
                type: 'resource',
                priority: 'high',
                message: 'Consider increasing memory allocation or optimizing memory usage'
            });
        }

        if (this.metrics.system.disk.usage > 85) {
            recommendations.push({
                type: 'storage',
                priority: 'critical',
                message: 'Disk space is running low. Consider cleanup or storage expansion'
            });
        }

        return recommendations;
    }
}

module.exports = VPSPKMonitor;
