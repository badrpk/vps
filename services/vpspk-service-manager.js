/**
 * VPS-PK Cloud Service Manager
 * Central orchestration system for all cloud services
 */

const ZephyrCore = require('./compute/zephyrcore');
const NebulaRun = require('./compute/nebularun');
const MoonVault = require('./storage/moonvault');
const AuroraBase = require('./database/aurorabase');
const SkyNet = require('./networking/skynet');
const IntelliSynth = require('./ai/intellisynth');
const GuardianGate = require('./security/guardiangate');
const VaultKey = require('./security/vaultkey');
const SkyMonitor = require('./management/skymonitor');
const BuildFlow = require('./devtools/buildflow');
const ApiStar = require('./devtools/apistar');
const EdgeForge = require('./iot/edgeforge');
const MessageFlow = require('./integration/messageflow');
const ContainerForge = require('./integration/containerforge');
const MediaStream = require('./media/mediastream');
const ChainForge = require('./blockchain/chainforge');
const BusinessHub = require('./business/businesshub');
const CloudBridge = require('./hybrid/cloudbridge');
const EnterpriseGuard = require('./enterprise/enterpriseguard');
const DataStream = require('./analytics/datastream');
const InsightForge = require('./analytics/insightforge');

class VPSPKServiceManager {
    constructor(config = {}) {
        this.config = {
            region: config.region || 'us-east-1',
            apiVersion: config.apiVersion || 'v1',
            enableLogging: config.enableLogging || true,
            enableMetrics: config.enableMetrics || true,
            ...config
        };
        
        // Initialize service instances
        this.services = {
            compute: {
                zephyrcore: new ZephyrCore(this.config),
                nebularun: new NebulaRun(this.config)
            },
            storage: {
                moonvault: new MoonVault(this.config)
            },
            database: {
                aurorabase: new AuroraBase(this.config)
            },
            networking: {
                skynet: new SkyNet(this.config)
            },
            ai: {
                intellisynth: new IntelliSynth(this.config)
            },
            security: {
                guardiangate: new GuardianGate(this.config),
                vaultkey: new VaultKey(this.config)
            },
            management: {
                skymonitor: new SkyMonitor(this.config)
            },
            devtools: {
                buildflow: new BuildFlow(this.config),
                apistar: new ApiStar(this.config)
            },
            iot: {
                edgeforge: new EdgeForge(this.config)
            },
            integration: {
                messageflow: new MessageFlow(this.config),
                containerforge: new ContainerForge(this.config)
            },
            media: {
                mediastream: new MediaStream(this.config)
            },
            blockchain: {
                chainforge: new ChainForge(this.config)
            },
            business: {
                businesshub: new BusinessHub(this.config)
            },
            hybrid: {
                cloudbridge: new CloudBridge(this.config)
            },
            enterprise: {
                enterpriseguard: new EnterpriseGuard(this.config)
            },
            analytics: {
                datastream: new DataStream(this.config),
                insightforge: new InsightForge(this.config)
            }
        };
        
        this.apiKeys = new Map();
        this.rateLimits = new Map();
        this.auditLogs = [];
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            servicesUsed: new Map()
        };
    }

    /**
     * Main API endpoint handler
     */
    async handleRequest(method, path, headers, body, queryParams) {
        const startTime = Date.now();
        const requestId = this.generateRequestId();
        
        try {
            // Authenticate request
            const authResult = await this.authenticateRequest(headers);
            if (!authResult.success) {
                return this.createErrorResponse(401, 'Unauthorized', requestId);
            }

            // Rate limiting
            const rateLimitResult = await this.checkRateLimit(authResult.apiKey);
            if (!rateLimitResult.allowed) {
                return this.createErrorResponse(429, 'Rate limit exceeded', requestId);
            }

            // Parse and route request
            const routeResult = await this.routeRequest(method, path, body, queryParams);
            
            // Log successful request
            this.logRequest(requestId, method, path, 200, Date.now() - startTime);
            this.updateMetrics(true, Date.now() - startTime, routeResult.service);
            
            return {
                success: true,
                requestId,
                data: routeResult.data,
                message: routeResult.message || 'Request processed successfully'
            };

        } catch (error) {
            // Log failed request
            this.logRequest(requestId, method, path, 500, Date.now() - startTime, error.message);
            this.updateMetrics(false, Date.now() - startTime);
            
            return this.createErrorResponse(500, error.message, requestId);
        }
    }

    /**
     * Route requests to appropriate services
     */
    async routeRequest(method, path, body, queryParams) {
        const pathParts = path.split('/').filter(part => part);
        
        // Remove 'api' and 'v1' from the beginning if present
        if (pathParts[0] === 'api' && pathParts[1] === 'v1') {
            pathParts.splice(0, 2);
        }
        
        if (pathParts.length < 2) {
            throw new Error('Invalid API path');
        }

        const [serviceCategory, serviceName, ...actionParts] = pathParts;
        const action = actionParts.join('/');

        // Validate service category and name
        if (!this.services[serviceCategory] || !this.services[serviceCategory][serviceName]) {
            throw new Error(`Service ${serviceCategory}/${serviceName} not found`);
        }

        const service = this.services[serviceCategory][serviceName];
        
        // Route to appropriate service method
        switch (method.toLowerCase()) {
            case 'get':
                return await this.handleGetRequest(service, action, queryParams);
            case 'post':
                return await this.handlePostRequest(service, action, body);
            case 'put':
                return await this.handlePutRequest(service, action, body);
            case 'delete':
                return await this.handleDeleteRequest(service, action, queryParams);
            default:
                throw new Error(`Unsupported HTTP method: ${method}`);
        }
    }

    /**
     * Handle GET requests
     */
    async handleGetRequest(service, action, queryParams) {
        switch (action) {
            case 'instances':
                return {
                    service: 'compute',
                    data: service.listInstances(queryParams),
                    message: 'Instances retrieved successfully'
                };
            case 'metrics':
                return {
                    service: 'compute',
                    data: service.getMetrics(),
                    message: 'Metrics retrieved successfully'
                };
            case 'buckets':
                return {
                    service: 'storage',
                    data: service.listBuckets(),
                    message: 'Buckets retrieved successfully'
                };
            case 'clusters':
                return {
                    service: 'database',
                    data: service.listClusters(),
                    message: 'Clusters retrieved successfully'
                };
            case 'streams':
                return {
                    service: 'analytics',
                    data: service.listStreams(),
                    message: 'Streams retrieved successfully'
                };
            case 'processors':
                return {
                    service: 'analytics',
                    data: service.listProcessors(),
                    message: 'Processors retrieved successfully'
                };
            case 'dashboards':
                return {
                    service: 'analytics',
                    data: service.listDashboards(),
                    message: 'Dashboards retrieved successfully'
                };
            case 'reports':
                return {
                    service: 'analytics',
                    data: service.listReports(),
                    message: 'Reports retrieved successfully'
                };
            case 'datasets':
                return {
                    service: 'analytics',
                    data: service.listDatasets(),
                    message: 'Datasets retrieved successfully'
                };
            case 'visualizations':
                return {
                    service: 'analytics',
                    data: service.listVisualizations(),
                    message: 'Visualizations retrieved successfully'
                };
            case 'records':
                return {
                    service: 'analytics',
                    data: service.getRecords(queryParams.streamId, queryParams.limit),
                    message: 'Records retrieved successfully'
                };
            default:
                throw new Error(`Unknown GET action: ${action}`);
        }
    }

    /**
     * Handle POST requests
     */
    async handlePostRequest(service, action, body) {
        switch (action) {
            case 'instances':
                return {
                    service: 'compute',
                    data: await service.createInstance(body),
                    message: 'Instance created successfully'
                };
            case 'buckets':
                return {
                    service: 'storage',
                    data: await service.createBucket(body),
                    message: 'Bucket created successfully'
                };
            case 'clusters':
                return {
                    service: 'database',
                    data: await service.createCluster(body),
                    message: 'Cluster created successfully'
                };
            case 'upload':
                return {
                    service: 'storage',
                    data: await service.uploadObject(body.bucketName, body.objectKey, body.data, body.options),
                    message: 'Object uploaded successfully'
                };
            case 'streams':
                return {
                    service: 'analytics',
                    data: await service.createStream(body),
                    message: 'Stream created successfully'
                };
            case 'processors':
                return {
                    service: 'analytics',
                    data: await service.createProcessor(body),
                    message: 'Processor created successfully'
                };
            case 'dashboards':
                return {
                    service: 'analytics',
                    data: await service.createDashboard(body),
                    message: 'Dashboard created successfully'
                };
            case 'reports':
                return {
                    service: 'analytics',
                    data: await service.createReport(body),
                    message: 'Report created successfully'
                };
            case 'datasets':
                return {
                    service: 'analytics',
                    data: await service.createDataset(body),
                    message: 'Dataset created successfully'
                };
            case 'visualizations':
                return {
                    service: 'analytics',
                    data: await service.createVisualization(body),
                    message: 'Visualization created successfully'
                };
            case 'records':
                return {
                    service: 'analytics',
                    data: await service.putRecord(body.streamId, body.record),
                    message: 'Record added successfully'
                };
            case 'query':
                return {
                    service: 'analytics',
                    data: await service.executeQuery(body.query),
                    message: 'Query executed successfully'
                };
            default:
                throw new Error(`Unknown POST action: ${action}`);
        }
    }

    /**
     * Handle PUT requests
     */
    async handlePutRequest(service, action, body) {
        switch (action) {
            case 'instances/start':
                return {
                    service: 'compute',
                    data: await service.startInstance(body.instanceId),
                    message: 'Instance started successfully'
                };
            case 'instances/stop':
                return {
                    service: 'compute',
                    data: await service.stopInstance(body.instanceId, body.force),
                    message: 'Instance stopped successfully'
                };
            case 'instances/resize':
                return {
                    service: 'compute',
                    data: await service.resizeInstance(body.instanceId, body.newConfig),
                    message: 'Instance resized successfully'
                };
            case 'clusters/modify':
                return {
                    service: 'database',
                    data: await service.modifyCluster(body.clusterId, body.modifications),
                    message: 'Cluster modified successfully'
                };
            default:
                throw new Error(`Unknown PUT action: ${action}`);
        }
    }

    /**
     * Handle DELETE requests
     */
    async handleDeleteRequest(service, action, queryParams) {
        switch (action) {
            case 'instances':
                return {
                    service: 'compute',
                    data: await service.terminateInstance(queryParams.instanceId),
                    message: 'Instance terminated successfully'
                };
            case 'buckets':
                return {
                    service: 'storage',
                    data: await service.deleteBucket(queryParams.bucketName, queryParams.force),
                    message: 'Bucket deleted successfully'
                };
            case 'clusters':
                return {
                    service: 'database',
                    data: await service.deleteCluster(queryParams.clusterId, queryParams.skipFinalSnapshot),
                    message: 'Cluster deleted successfully'
                };
            case 'objects':
                return {
                    service: 'storage',
                    data: await service.deleteObject(queryParams.bucketName, queryParams.objectKey, queryParams.version),
                    message: 'Object deleted successfully'
                };
            default:
                throw new Error(`Unknown DELETE action: ${action}`);
        }
    }

    /**
     * Authenticate API requests
     */
    async authenticateRequest(headers) {
        const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
            return { success: false, message: 'API key required' };
        }

        const keyInfo = this.apiKeys.get(apiKey);
        if (!keyInfo) {
            return { success: false, message: 'Invalid API key' };
        }

        if (keyInfo.expiresAt && keyInfo.expiresAt < Date.now()) {
            return { success: false, message: 'API key expired' };
        }

        return { success: true, apiKey, keyInfo };
    }

    /**
     * Check rate limits
     */
    async checkRateLimit(apiKey) {
        const keyInfo = this.apiKeys.get(apiKey);
        const limit = keyInfo?.rateLimit || 1000; // requests per hour
        
        const now = Date.now();
        const hourAgo = now - (60 * 60 * 1000);
        
        const requests = this.rateLimits.get(apiKey) || [];
        const recentRequests = requests.filter(timestamp => timestamp > hourAgo);
        
        if (recentRequests.length >= limit) {
            return { allowed: false, remaining: 0, resetTime: recentRequests[0] + (60 * 60 * 1000) };
        }

        recentRequests.push(now);
        this.rateLimits.set(apiKey, recentRequests);
        
        return { 
            allowed: true, 
            remaining: limit - recentRequests.length, 
            resetTime: now + (60 * 60 * 1000) 
        };
    }

    /**
     * Create API key
     */
    createApiKey(keyConfig = {}) {
        const apiKey = this.generateApiKey();
        const keyInfo = {
            key: apiKey,
            name: keyConfig.name || `API Key ${Date.now()}`,
            permissions: keyConfig.permissions || ['read', 'write'],
            rateLimit: keyConfig.rateLimit || 1000,
            expiresAt: keyConfig.expiresAt || null,
            createdAt: new Date(),
            lastUsed: null
        };

        this.apiKeys.set(apiKey, keyInfo);
        
        return {
            success: true,
            apiKey,
            keyInfo,
            message: 'API key created successfully'
        };
    }

    /**
     * Get service status
     */
    getServiceStatus() {
        const status = {
            overall: 'healthy',
            services: {},
            metrics: this.metrics,
            uptime: process.uptime(),
            timestamp: new Date()
        };

        // Check each service category
        for (const [category, services] of Object.entries(this.services)) {
            status.services[category] = {};
            
            for (const [serviceName, service] of Object.entries(services)) {
                try {
                    // Simple health check for each service
                    const healthCheck = service.getMetrics ? service.getMetrics() : { success: true };
                    status.services[category][serviceName] = {
                        status: healthCheck.success ? 'healthy' : 'unhealthy',
                        lastCheck: new Date()
                    };
                } catch (error) {
                    status.services[category][serviceName] = {
                        status: 'unhealthy',
                        error: error.message,
                        lastCheck: new Date()
                    };
                }
            }
        }

        return {
            success: true,
            status,
            message: 'Service status retrieved successfully'
        };
    }

    /**
     * Get audit logs
     */
    getAuditLogs(filters = {}) {
        let logs = [...this.auditLogs];
        
        // Apply filters
        if (filters.startTime) {
            logs = logs.filter(log => log.timestamp >= filters.startTime);
        }
        
        if (filters.endTime) {
            logs = logs.filter(log => log.timestamp <= filters.endTime);
        }
        
        if (filters.method) {
            logs = logs.filter(log => log.method === filters.method);
        }
        
        if (filters.statusCode) {
            logs = logs.filter(log => log.statusCode === filters.statusCode);
        }

        // Sort by timestamp (newest first)
        logs.sort((a, b) => b.timestamp - a.timestamp);
        
        // Pagination
        const page = filters.page || 1;
        const limit = filters.limit || 100;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        return {
            success: true,
            logs: logs.slice(startIndex, endIndex),
            total: logs.length,
            page,
            limit,
            message: 'Audit logs retrieved successfully'
        };
    }

    // Helper methods
    generateRequestId() {
        return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateApiKey() {
        return `vpspk_${Math.random().toString(36).substr(2, 32)}`;
    }

    logRequest(requestId, method, path, statusCode, responseTime, error = null) {
        const log = {
            requestId,
            method,
            path,
            statusCode,
            responseTime,
            timestamp: Date.now(),
            error
        };
        
        this.auditLogs.push(log);
        
        // Keep only last 10000 logs
        if (this.auditLogs.length > 10000) {
            this.auditLogs = this.auditLogs.slice(-10000);
        }
    }

    updateMetrics(success, responseTime, service = null) {
        this.metrics.totalRequests++;
        
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
        }
        
        // Update average response time
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
            this.metrics.totalRequests;
        
        if (service) {
            const count = this.metrics.servicesUsed.get(service) || 0;
            this.metrics.servicesUsed.set(service, count + 1);
        }
    }

    createErrorResponse(statusCode, message, requestId) {
        return {
            success: false,
            requestId,
            error: {
                code: statusCode,
                message
            },
            timestamp: new Date()
        };
    }
}

module.exports = VPSPKServiceManager;
