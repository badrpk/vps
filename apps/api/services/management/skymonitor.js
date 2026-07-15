/**
 * SkyMonitor - Infrastructure Monitoring & Alerting System
 * Comprehensive monitoring solution with real-time metrics, alerting, and dashboards
 */

class SkyMonitor {
    constructor(config = {}) {
        this.config = {
            region: config.region || 'us-east-1',
            defaultRetentionDays: config.defaultRetentionDays || 30,
            enableRealTimeMonitoring: config.enableRealTimeMonitoring || true,
            enablePredictiveAlerting: config.enablePredictiveAlerting || true,
            maxMetricsPerResource: config.maxMetricsPerResource || 1000,
            ...config
        };
        
        this.resources = new Map();
        this.metrics = new Map();
        this.alarms = new Map();
        this.dashboards = new Map();
        this.logGroups = new Map();
        this.logStreams = new Map();
        this.insights = new Map();
        
        this.metricsBuffer = new Map();
        this.alertHistory = new Map();
        
        this.metrics = {
            totalResources: 0,
            totalMetrics: 0,
            totalAlarms: 0,
            activeAlarms: 0,
            totalDashboards: 0,
            totalLogGroups: 0,
            totalLogStreams: 0,
            totalInsights: 0,
            dataPointsProcessed: 0,
            alertsTriggered: 0
        };
        
        this.startMetricsCollection();
    }

    /**
     * Register a resource for monitoring
     */
    async registerResource(resourceConfig) {
        const resourceId = this.generateResourceId();
        const resource = {
            id: resourceId,
            name: resourceConfig.name || `resource-${resourceId}`,
            type: resourceConfig.type || 'generic',
            region: resourceConfig.region || this.config.region,
            tags: resourceConfig.tags || {},
            createdAt: new Date(),
            status: 'active',
            metrics: resourceConfig.metrics || [],
            dimensions: resourceConfig.dimensions || {},
            retentionDays: resourceConfig.retentionDays || this.config.defaultRetentionDays,
            monitoringConfig: {
                enabled: resourceConfig.monitoringEnabled !== false,
                interval: resourceConfig.monitoringInterval || 60,
                detailedMonitoring: resourceConfig.detailedMonitoring || false
            },
            health: {
                status: 'healthy',
                lastCheck: new Date(),
                checks: []
            }
        };

        this.resources.set(resourceId, resource);
        this.updateMetrics();
        
        // Start monitoring the resource
        this.startResourceMonitoring(resourceId);
        
        return {
            success: true,
            resourceId,
            resource,
            message: 'Resource registered for monitoring successfully'
        };
    }

    /**
     * Put metric data
     */
    async putMetricData(resourceId, metricData) {
        const resource = this.resources.get(resourceId);
        if (!resource) {
            throw new Error(`Resource ${resourceId} not found`);
        }

        const timestamp = new Date();
        const metricId = this.generateMetricId();
        
        const metric = {
            id: metricId,
            resourceId,
            namespace: metricData.namespace || 'VPS-PK/Cloud',
            metricName: metricData.metricName,
            value: metricData.value,
            unit: metricData.unit || 'Count',
            timestamp,
            dimensions: metricData.dimensions || {},
            statistics: metricData.statistics || ['Average'],
            retentionDays: resource.retentionDays
        };

        // Store metric
        this.metrics.set(metricId, metric);
        
        // Add to metrics buffer for real-time processing
        this.addToMetricsBuffer(resourceId, metric);
        
        // Update resource health
        this.updateResourceHealth(resourceId, metric);
        
        // Check alarms
        await this.checkAlarms(resourceId, metric);
        
        this.metrics.dataPointsProcessed++;
        this.updateMetrics();
        
        return {
            success: true,
            metricId,
            message: 'Metric data stored successfully'
        };
    }

    /**
     * Create an alarm
     */
    async createAlarm(alarmConfig) {
        const alarmId = this.generateAlarmId();
        const alarm = {
            id: alarmId,
            name: alarmConfig.name || `alarm-${alarmId}`,
            description: alarmConfig.description || '',
            resourceId: alarmConfig.resourceId,
            metricName: alarmConfig.metricName,
            namespace: alarmConfig.namespace || 'VPS-PK/Cloud',
            statistic: alarmConfig.statistic || 'Average',
            period: alarmConfig.period || 300,
            evaluationPeriods: alarmConfig.evaluationPeriods || 2,
            threshold: alarmConfig.threshold,
            comparisonOperator: alarmConfig.comparisonOperator || 'GreaterThanThreshold',
            treatMissingData: alarmConfig.treatMissingData || 'missing',
            alarmActions: alarmConfig.alarmActions || [],
            okActions: alarmConfig.okActions || [],
            insufficientDataActions: alarmConfig.insufficientDataActions || [],
            tags: alarmConfig.tags || {},
            createdAt: new Date(),
            state: 'INSUFFICIENT_DATA',
            stateReason: 'Alarm created',
            stateUpdatedTimestamp: new Date(),
            metrics: {
                evaluations: 0,
                alarmsTriggered: 0,
                okStates: 0
            }
        };

        this.alarms.set(alarmId, alarm);
        this.updateMetrics();
        
        return {
            success: true,
            alarmId,
            alarm,
            message: 'Alarm created successfully'
        };
    }

    /**
     * Create a dashboard
     */
    async createDashboard(dashboardConfig) {
        const dashboardId = this.generateDashboardId();
        const dashboard = {
            id: dashboardId,
            name: dashboardConfig.name || `dashboard-${dashboardId}`,
            description: dashboardConfig.description || '',
            widgets: dashboardConfig.widgets || [],
            tags: dashboardConfig.tags || {},
            createdAt: new Date(),
            lastModified: new Date(),
            permissions: dashboardConfig.permissions || 'private',
            refreshInterval: dashboardConfig.refreshInterval || 60,
            timeRange: dashboardConfig.timeRange || {
                start: '-1h',
                end: 'now'
            }
        };

        this.dashboards.set(dashboardId, dashboard);
        this.updateMetrics();
        
        return {
            success: true,
            dashboardId,
            dashboard,
            message: 'Dashboard created successfully'
        };
    }

    /**
     * Create a log group
     */
    async createLogGroup(logGroupConfig) {
        const logGroupName = logGroupConfig.name || this.generateLogGroupName();
        
        if (this.logGroups.has(logGroupName)) {
            throw new Error(`Log group ${logGroupName} already exists`);
        }

        const logGroup = {
            name: logGroupName,
            retentionInDays: logGroupConfig.retentionInDays || 30,
            tags: logGroupConfig.tags || {},
            createdAt: new Date(),
            metrics: {
                logStreams: 0,
                logEvents: 0,
                storedBytes: 0
            }
        };

        this.logGroups.set(logGroupName, logGroup);
        this.updateMetrics();
        
        return {
            success: true,
            logGroupName,
            logGroup,
            message: 'Log group created successfully'
        };
    }

    /**
     * Put log events
     */
    async putLogEvents(logGroupName, logStreamName, logEvents) {
        const logGroup = this.logGroups.get(logGroupName);
        if (!logGroup) {
            throw new Error(`Log group ${logGroupName} not found`);
        }

        // Create log stream if it doesn't exist
        if (!this.logStreams.has(logStreamName)) {
            await this.createLogStream(logGroupName, logStreamName);
        }

        const logStream = this.logStreams.get(logStreamName);
        
        // Process log events
        for (const event of logEvents) {
            const logEvent = {
                timestamp: event.timestamp || Date.now(),
                message: event.message,
                logGroupName,
                logStreamName,
                storedAt: new Date()
            };
            
            // Store log event (simplified - in real implementation, use proper storage)
            logStream.events.push(logEvent);
            
            // Update metrics
            logGroup.metrics.logEvents++;
            logGroup.metrics.storedBytes += event.message.length;
        }
        
        return {
            success: true,
            logGroupName,
            logStreamName,
            eventsProcessed: logEvents.length,
            message: 'Log events stored successfully'
        };
    }

    /**
     * Create log stream
     */
    async createLogStream(logGroupName, logStreamName) {
        const logGroup = this.logGroups.get(logGroupName);
        if (!logGroup) {
            throw new Error(`Log group ${logGroupName} not found`);
        }

        const logStream = {
            name: logStreamName,
            logGroupName,
            createdAt: new Date(),
            lastEventTime: null,
            events: [],
            metrics: {
                eventCount: 0,
                lastIngestionTime: null
            }
        };

        this.logStreams.set(logStreamName, logStream);
        logGroup.metrics.logStreams++;
        this.updateMetrics();
        
        return {
            success: true,
            logStreamName,
            logStream,
            message: 'Log stream created successfully'
        };
    }

    /**
     * Get metric statistics
     */
    getMetricStatistics(resourceId, metricName, options = {}) {
        const resource = this.resources.get(resourceId);
        if (!resource) {
            throw new Error(`Resource ${resourceId} not found`);
        }

        const {
            namespace = 'VPS-PK/Cloud',
            startTime = new Date(Date.now() - 24 * 60 * 60 * 1000),
            endTime = new Date(),
            period = 300,
            statistics = ['Average'],
            unit = 'Count'
        } = options;

        // Get metrics for the resource and time range
        const relevantMetrics = Array.from(this.metrics.values())
            .filter(metric => 
                metric.resourceId === resourceId &&
                metric.metricName === metricName &&
                metric.namespace === namespace &&
                metric.timestamp >= startTime &&
                metric.timestamp <= endTime
            )
            .sort((a, b) => a.timestamp - b.timestamp);

        if (relevantMetrics.length === 0) {
            return {
                success: true,
                datapoints: [],
                message: 'No data points found for the specified criteria'
            };
        }

        // Calculate statistics
        const datapoints = this.calculateStatistics(relevantMetrics, statistics, period);
        
        return {
            success: true,
            datapoints,
            label: `${namespace}/${metricName}`,
            message: 'Metric statistics retrieved successfully'
        };
    }

    /**
     * Get resource health
     */
    getResourceHealth(resourceId) {
        const resource = this.resources.get(resourceId);
        if (!resource) {
            throw new Error(`Resource ${resourceId} not found`);
        }

        return {
            success: true,
            resourceId,
            health: {
                ...resource.health,
                metrics: this.getResourceMetrics(resourceId)
            },
            message: 'Resource health retrieved successfully'
        };
    }

    /**
     * Get alarm details
     */
    getAlarm(alarmId) {
        const alarm = this.alarms.get(alarmId);
        if (!alarm) {
            throw new Error(`Alarm ${alarmId} not found`);
        }

        return {
            success: true,
            alarm: {
                ...alarm,
                history: this.getAlarmHistory(alarmId)
            }
        };
    }

    /**
     * List all alarms
     */
    listAlarms(filters = {}) {
        let alarms = Array.from(this.alarms.values());
        
        // Apply filters
        if (filters.state) {
            alarms = alarms.filter(alarm => alarm.state === filters.state);
        }
        
        if (filters.resourceId) {
            alarms = alarms.filter(alarm => alarm.resourceId === filters.resourceId);
        }

        return {
            success: true,
            alarms: alarms.map(alarm => ({
                id: alarm.id,
                name: alarm.name,
                description: alarm.description,
                state: alarm.state,
                stateReason: alarm.stateReason,
                stateUpdatedTimestamp: alarm.stateUpdatedTimestamp,
                resourceId: alarm.resourceId,
                metricName: alarm.metricName,
                threshold: alarm.threshold,
                comparisonOperator: alarm.comparisonOperator
            })),
            total: alarms.length
        };
    }

    /**
     * Get dashboard data
     */
    getDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard ${dashboardId} not found`);
        }

        // Populate dashboard with current data
        const populatedDashboard = {
            ...dashboard,
            widgets: dashboard.widgets.map(widget => ({
                ...widget,
                data: this.getWidgetData(widget)
            }))
        };

        return {
            success: true,
            dashboard: populatedDashboard
        };
    }

    /**
     * Get platform metrics
     */
    getMetrics() {
        return {
            success: true,
            metrics: {
                ...this.metrics,
                resourceHealth: this.getOverallResourceHealth(),
                alarmSummary: this.getAlarmSummary()
            }
        };
    }

    // Helper methods
    generateResourceId() {
        return `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateMetricId() {
        return `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateAlarmId() {
        return `alarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateDashboardId() {
        return `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateLogGroupName() {
        return `/vps-pk/cloud/${Date.now()}`;
    }

    startResourceMonitoring(resourceId) {
        const resource = this.resources.get(resourceId);
        if (!resource || !resource.monitoringConfig.enabled) return;

        const interval = resource.monitoringConfig.interval * 1000;
        
        const monitoringInterval = setInterval(() => {
            this.collectResourceMetrics(resourceId);
        }, interval);

        // Store interval ID for cleanup
        resource.monitoringInterval = monitoringInterval;
    }

    async collectResourceMetrics(resourceId) {
        const resource = this.resources.get(resourceId);
        if (!resource) return;

        // Simulate metric collection based on resource type
        const metrics = this.generateResourceMetrics(resource);
        
        for (const metric of metrics) {
            await this.putMetricData(resourceId, metric);
        }
    }

    generateResourceMetrics(resource) {
        const baseMetrics = [
            { metricName: 'CPUUtilization', value: Math.random() * 100, unit: 'Percent' },
            { metricName: 'MemoryUtilization', value: Math.random() * 100, unit: 'Percent' },
            { metricName: 'NetworkIn', value: Math.random() * 1000, unit: 'Bytes' },
            { metricName: 'NetworkOut', value: Math.random() * 1000, unit: 'Bytes' }
        ];

        // Add resource-specific metrics
        if (resource.type === 'compute') {
            baseMetrics.push(
                { metricName: 'DiskReadOps', value: Math.random() * 100, unit: 'Count' },
                { metricName: 'DiskWriteOps', value: Math.random() * 100, unit: 'Count' }
            );
        }

        return baseMetrics;
    }

    addToMetricsBuffer(resourceId, metric) {
        if (!this.metricsBuffer.has(resourceId)) {
            this.metricsBuffer.set(resourceId, []);
        }
        
        const buffer = this.metricsBuffer.get(resourceId);
        buffer.push(metric);
        
        // Keep only last 1000 metrics per resource
        if (buffer.length > 1000) {
            buffer.shift();
        }
    }

    updateResourceHealth(resourceId, metric) {
        const resource = this.resources.get(resourceId);
        if (!resource) return;

        // Simple health check based on CPU utilization
        if (metric.metricName === 'CPUUtilization') {
            if (metric.value > 90) {
                resource.health.status = 'critical';
            } else if (metric.value > 80) {
                resource.health.status = 'warning';
            } else {
                resource.health.status = 'healthy';
            }
            
            resource.health.lastCheck = new Date();
        }
    }

    async checkAlarms(resourceId, metric) {
        const resourceAlarms = Array.from(this.alarms.values())
            .filter(alarm => alarm.resourceId === resourceId && alarm.metricName === metric.metricName);

        for (const alarm of resourceAlarms) {
            await this.evaluateAlarm(alarm, metric);
        }
    }

    async evaluateAlarm(alarm, metric) {
        alarm.metrics.evaluations++;
        
        let shouldAlarm = false;
        
        switch (alarm.comparisonOperator) {
            case 'GreaterThanThreshold':
                shouldAlarm = metric.value > alarm.threshold;
                break;
            case 'LessThanThreshold':
                shouldAlarm = metric.value < alarm.threshold;
                break;
            case 'GreaterThanOrEqualToThreshold':
                shouldAlarm = metric.value >= alarm.threshold;
                break;
            case 'LessThanOrEqualToThreshold':
                shouldAlarm = metric.value <= alarm.threshold;
                break;
        }

        if (shouldAlarm && alarm.state !== 'ALARM') {
            await this.triggerAlarm(alarm, metric);
        } else if (!shouldAlarm && alarm.state === 'ALARM') {
            await this.clearAlarm(alarm, metric);
        }
    }

    async triggerAlarm(alarm, metric) {
        alarm.state = 'ALARM';
        alarm.stateReason = `Threshold breached: ${metric.value} ${alarm.comparisonOperator} ${alarm.threshold}`;
        alarm.stateUpdatedTimestamp = new Date();
        alarm.metrics.alarmsTriggered++;
        
        this.metrics.alertsTriggered++;
        
        // Store alarm history
        this.alertHistory.set(`${alarm.id}-${Date.now()}`, {
            alarmId: alarm.id,
            action: 'ALARM',
            timestamp: new Date(),
            metricValue: metric.value,
            threshold: alarm.threshold
        });
        
        // Execute alarm actions
        for (const action of alarm.alarmActions) {
            await this.executeAlarmAction(action, alarm, metric);
        }
    }

    async clearAlarm(alarm, metric) {
        alarm.state = 'OK';
        alarm.stateReason = `Threshold cleared: ${metric.value} ${alarm.comparisonOperator} ${alarm.threshold}`;
        alarm.stateUpdatedTimestamp = new Date();
        alarm.metrics.okStates++;
        
        // Execute OK actions
        for (const action of alarm.okActions) {
            await this.executeAlarmAction(action, alarm, metric);
        }
    }

    async executeAlarmAction(action, alarm, metric) {
        // Simulate alarm action execution
        console.log(`Executing alarm action: ${action} for alarm ${alarm.name}`);
    }

    calculateStatistics(metrics, statistics, period) {
        const datapoints = [];
        const values = metrics.map(m => m.value);
        
        for (const stat of statistics) {
            let value;
            switch (stat) {
                case 'Average':
                    value = values.reduce((sum, val) => sum + val, 0) / values.length;
                    break;
                case 'Maximum':
                    value = Math.max(...values);
                    break;
                case 'Minimum':
                    value = Math.min(...values);
                    break;
                case 'Sum':
                    value = values.reduce((sum, val) => sum + val, 0);
                    break;
                default:
                    value = values.reduce((sum, val) => sum + val, 0) / values.length;
            }
            
            datapoints.push({
                timestamp: metrics[metrics.length - 1].timestamp,
                value,
                unit: metrics[0].unit
            });
        }
        
        return datapoints;
    }

    getResourceMetrics(resourceId) {
        const buffer = this.metricsBuffer.get(resourceId) || [];
        return {
            totalMetrics: buffer.length,
            lastMetric: buffer[buffer.length - 1],
            averageValue: buffer.length > 0 ? 
                buffer.reduce((sum, m) => sum + m.value, 0) / buffer.length : 0
        };
    }

    getAlarmHistory(alarmId) {
        return Array.from(this.alertHistory.values())
            .filter(history => history.alarmId === alarmId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 100);
    }

    getWidgetData(widget) {
        // Simulate widget data based on widget configuration
        return {
            values: Array.from({ length: 20 }, () => Math.random() * 100),
            labels: Array.from({ length: 20 }, (_, i) => new Date(Date.now() - (19 - i) * 300000).toISOString())
        };
    }

    getOverallResourceHealth() {
        const resources = Array.from(this.resources.values());
        const healthy = resources.filter(r => r.health.status === 'healthy').length;
        const warning = resources.filter(r => r.health.status === 'warning').length;
        const critical = resources.filter(r => r.health.status === 'critical').length;
        
        return {
            healthy,
            warning,
            critical,
            total: resources.length,
            healthPercentage: resources.length > 0 ? (healthy / resources.length) * 100 : 100
        };
    }

    getAlarmSummary() {
        const alarms = Array.from(this.alarms.values());
        const ok = alarms.filter(a => a.state === 'OK').length;
        const alarm = alarms.filter(a => a.state === 'ALARM').length;
        const insufficient = alarms.filter(a => a.state === 'INSUFFICIENT_DATA').length;
        
        return {
            ok,
            alarm,
            insufficient,
            total: alarms.length
        };
    }

    startMetricsCollection() {
        // Start background metrics collection
        setInterval(() => {
            this.processMetricsBuffer();
        }, 60000); // Every minute
    }

    processMetricsBuffer() {
        // Process buffered metrics for insights and cleanup
        for (const [resourceId, metrics] of this.metricsBuffer) {
            if (metrics.length > 0) {
                // Generate insights
                this.generateInsights(resourceId, metrics);
                
                // Cleanup old metrics
                const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const filteredMetrics = metrics.filter(m => m.timestamp > cutoffTime);
                this.metricsBuffer.set(resourceId, filteredMetrics);
            }
        }
    }

    generateInsights(resourceId, metrics) {
        // Generate insights based on metric patterns
        const insightId = this.generateInsightId();
        const insight = {
            id: insightId,
            resourceId,
            type: 'anomaly',
            description: 'Detected unusual metric pattern',
            confidence: Math.random() * 100,
            timestamp: new Date(),
            metrics: metrics.slice(-10) // Last 10 metrics
        };
        
        this.insights.set(insightId, insight);
    }

    generateInsightId() {
        return `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    updateMetrics() {
        this.metrics.totalResources = this.resources.size;
        this.metrics.totalMetrics = this.metrics.size;
        this.metrics.totalAlarms = this.alarms.size;
        this.metrics.activeAlarms = Array.from(this.alarms.values())
            .filter(alarm => alarm.state === 'ALARM').length;
        this.metrics.totalDashboards = this.dashboards.size;
        this.metrics.totalLogGroups = this.logGroups.size;
        this.metrics.totalLogStreams = this.logStreams.size;
        this.metrics.totalInsights = this.insights.size;
    }
}

module.exports = SkyMonitor;
