/**
 * VPS-PK Cloud REST API Server
 * Express.js server for exposing cloud services via REST API
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const VPSPKServiceManager = require('./services/vpspk-service-manager');

class VPSPKAPIServer {
    constructor(config = {}) {
        this.config = {
            port: config.port || 3000,
            host: config.host || '0.0.0.0',
            enableCORS: config.enableCORS !== false,
            enableHelmet: config.enableHelmet !== false,
            enableRateLimit: config.enableRateLimit !== false,
            rateLimitWindowMs: config.rateLimitWindowMs || 15 * 60 * 1000, // 15 minutes
            rateLimitMax: config.rateLimitMax || 100, // limit each IP to 100 requests per windowMs
            ...config
        };
        
        this.app = express();
        this.server = null;
        this.serviceManager = new VPSPKServiceManager(config);
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * Setup middleware
     */
    setupMiddleware() {
        // Security middleware
        if (this.config.enableHelmet) {
            this.app.use(helmet());
        }

        // CORS middleware
        if (this.config.enableCORS) {
            this.app.use(cors({
                origin: this.config.corsOrigin || '*',
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
            }));
        }

        // Rate limiting
        if (this.config.enableRateLimit) {
            const limiter = rateLimit({
                windowMs: this.config.rateLimitWindowMs,
                max: this.config.rateLimitMax,
                message: {
                    success: false,
                    error: {
                        code: 429,
                        message: 'Too many requests from this IP, please try again later.'
                    }
                },
                standardHeaders: true,
                legacyHeaders: false
            });
            this.app.use(limiter);
        }

        // Body parsing middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging middleware
        this.app.use((req, res, next) => {
            req.startTime = Date.now();
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
            next();
        });
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                success: true,
                status: 'healthy',
                timestamp: new Date(),
                uptime: process.uptime(),
                version: '1.0.0'
            });
        });

        // Service status endpoint
        this.app.get('/status', async (req, res) => {
            try {
                const status = this.serviceManager.getServiceStatus();
                res.json(status);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: {
                        code: 500,
                        message: error.message
                    }
                });
            }
        });

        // API documentation endpoint
        this.app.get('/docs', (req, res) => {
            res.json({
                success: true,
                message: 'VPS-PK Cloud API Documentation',
                version: '1.0.0',
                endpoints: {
                    compute: {
                        'GET /api/v1/compute/zephyrcore/instances': 'List ZephyrCore instances',
                        'POST /api/v1/compute/zephyrcore/instances': 'Create ZephyrCore instance',
                        'PUT /api/v1/compute/zephyrcore/instances/start': 'Start instance',
                        'PUT /api/v1/compute/zephyrcore/instances/stop': 'Stop instance',
                        'DELETE /api/v1/compute/zephyrcore/instances': 'Terminate instance',
                        'GET /api/v1/compute/nebularun/groups': 'List Auto Scaling Groups',
                        'POST /api/v1/compute/nebularun/groups': 'Create Auto Scaling Group',
                        'PUT /api/v1/compute/nebularun/groups/scale': 'Scale group'
                    },
                    storage: {
                        'GET /api/v1/storage/moonvault/buckets': 'List buckets',
                        'POST /api/v1/storage/moonvault/buckets': 'Create bucket',
                        'POST /api/v1/storage/moonvault/upload': 'Upload object',
                        'GET /api/v1/storage/moonvault/objects': 'List objects',
                        'DELETE /api/v1/storage/moonvault/objects': 'Delete object'
                    },
                    database: {
                        'GET /api/v1/database/aurorabase/clusters': 'List clusters',
                        'POST /api/v1/database/aurorabase/clusters': 'Create cluster',
                        'POST /api/v1/database/aurorabase/instances': 'Create instance',
                        'PUT /api/v1/database/aurorabase/clusters/modify': 'Modify cluster',
                        'DELETE /api/v1/database/aurorabase/clusters': 'Delete cluster'
                    },
                    networking: {
                        'GET /api/v1/networking/skynet/distributions': 'List CDN distributions',
                        'POST /api/v1/networking/skynet/distributions': 'Create CDN distribution',
                        'POST /api/v1/networking/skynet/serve': 'Serve content via CDN',
                        'POST /api/v1/networking/skynet/invalidate': 'Invalidate CDN cache'
                    },
                    ai: {
                        'GET /api/v1/ai/intellisynth/training-jobs': 'List training jobs',
                        'POST /api/v1/ai/intellisynth/training-jobs': 'Create training job',
                        'GET /api/v1/ai/intellisynth/models': 'List models',
                        'POST /api/v1/ai/intellisynth/models': 'Create model',
                        'GET /api/v1/ai/intellisynth/endpoints': 'List endpoints',
                        'POST /api/v1/ai/intellisynth/endpoints': 'Create endpoint',
                        'POST /api/v1/ai/intellisynth/invoke': 'Invoke model inference'
                    },
                    security: {
                        'GET /api/v1/security/guardiangate/groups': 'List security groups',
                        'POST /api/v1/security/guardiangate/groups': 'Create security group',
                        'POST /api/v1/security/guardiangate/rules': 'Add firewall rule',
                        'POST /api/v1/security/guardiangate/process': 'Process network packet',
                        'GET /api/v1/security/vaultkey/keys': 'List encryption keys',
                        'POST /api/v1/security/vaultkey/keys': 'Create encryption key',
                        'POST /api/v1/security/vaultkey/encrypt': 'Encrypt data',
                        'POST /api/v1/security/vaultkey/decrypt': 'Decrypt data'
                    },
                    management: {
                        'GET /api/v1/management/skymonitor/resources': 'List monitored resources',
                        'POST /api/v1/management/skymonitor/resources': 'Register resource',
                        'POST /api/v1/management/skymonitor/metrics': 'Put metric data',
                        'GET /api/v1/management/skymonitor/alarms': 'List alarms',
                        'POST /api/v1/management/skymonitor/alarms': 'Create alarm',
                        'GET /api/v1/management/skymonitor/dashboards': 'List dashboards',
                        'POST /api/v1/management/skymonitor/dashboards': 'Create dashboard'
                    },
                    devtools: {
                        'GET /api/v1/devtools/buildflow/projects': 'List CI/CD projects',
                        'POST /api/v1/devtools/buildflow/projects': 'Create CI/CD project',
                        'POST /api/v1/devtools/buildflow/builds': 'Start build',
                        'GET /api/v1/devtools/buildflow/pipelines': 'List pipelines',
                        'POST /api/v1/devtools/buildflow/pipelines': 'Create pipeline',
                        'POST /api/v1/devtools/buildflow/deployments': 'Deploy application',
                        'GET /api/v1/devtools/apistar/apis': 'List APIs',
                        'POST /api/v1/devtools/apistar/apis': 'Create API',
                        'POST /api/v1/devtools/apistar/gateways': 'Create API gateway',
                        'POST /api/v1/devtools/apistar/requests': 'Process API request',
                        'GET /api/v1/devtools/apistar/analytics': 'Get API analytics'
                    },
                    iot: {
                        'GET /api/v1/iot/edgeforge/devices': 'List IoT devices',
                        'POST /api/v1/iot/edgeforge/devices': 'Register device',
                        'POST /api/v1/iot/edgeforge/devices/data': 'Send device data',
                        'GET /api/v1/iot/edgeforge/nodes': 'List edge nodes',
                        'POST /api/v1/iot/edgeforge/nodes': 'Create edge node',
                        'POST /api/v1/iot/edgeforge/workloads': 'Deploy workload',
                        'GET /api/v1/iot/edgeforge/streams': 'List data streams',
                        'POST /api/v1/iot/edgeforge/streams': 'Create data stream'
                    },
                    integration: {
                        'GET /api/v1/integration/messageflow/queues': 'List message queues',
                        'POST /api/v1/integration/messageflow/queues': 'Create message queue',
                        'POST /api/v1/integration/messageflow/send': 'Send message',
                        'POST /api/v1/integration/messageflow/receive': 'Receive messages',
                        'GET /api/v1/integration/messageflow/topics': 'List topics',
                        'POST /api/v1/integration/messageflow/topics': 'Create topic',
                        'POST /api/v1/integration/messageflow/subscribe': 'Subscribe to topic',
                        'GET /api/v1/integration/containerforge/clusters': 'List Kubernetes clusters',
                        'POST /api/v1/integration/containerforge/clusters': 'Create cluster',
                        'POST /api/v1/integration/containerforge/deploy': 'Deploy application',
                        'POST /api/v1/integration/containerforge/scale': 'Scale deployment'
                    },
                    media: {
                        'GET /api/v1/media/mediastream/jobs': 'List media jobs',
                        'POST /api/v1/media/mediastream/jobs': 'Create media job',
                        'GET /api/v1/media/mediastream/pipelines': 'List pipelines',
                        'POST /api/v1/media/mediastream/pipelines': 'Create pipeline',
                        'GET /api/v1/media/mediastream/channels': 'List streaming channels',
                        'POST /api/v1/media/mediastream/channels': 'Create channel',
                        'POST /api/v1/media/mediastream/stream': 'Start streaming',
                        'POST /api/v1/media/mediastream/thumbnails': 'Generate thumbnails'
                    },
                    blockchain: {
                        'GET /api/v1/blockchain/chainforge/networks': 'List blockchain networks',
                        'POST /api/v1/blockchain/chainforge/networks': 'Create network',
                        'POST /api/v1/blockchain/chainforge/nodes': 'Add node',
                        'GET /api/v1/blockchain/chainforge/contracts': 'List smart contracts',
                        'POST /api/v1/blockchain/chainforge/contracts': 'Deploy contract',
                        'POST /api/v1/blockchain/chainforge/execute': 'Execute contract',
                        'GET /api/v1/blockchain/chainforge/tokens': 'List tokens',
                        'POST /api/v1/blockchain/chainforge/tokens': 'Create token',
                        'POST /api/v1/blockchain/chainforge/transfer': 'Transfer tokens'
                    },
                    business: {
                        'GET /api/v1/business/businesshub/organizations': 'List organizations',
                        'POST /api/v1/business/businesshub/organizations': 'Create organization',
                        'GET /api/v1/business/businesshub/users': 'List users',
                        'POST /api/v1/business/businesshub/users': 'Create user',
                        'GET /api/v1/business/businesshub/customers': 'List customers',
                        'POST /api/v1/business/businesshub/customers': 'Create customer',
                        'GET /api/v1/business/businesshub/orders': 'List orders',
                        'POST /api/v1/business/businesshub/orders': 'Create order',
                        'GET /api/v1/business/businesshub/projects': 'List projects',
                        'POST /api/v1/business/businesshub/projects': 'Create project',
                        'GET /api/v1/business/businesshub/tasks': 'List tasks',
                        'POST /api/v1/business/businesshub/tasks': 'Create task'
                    },
                    hybrid: {
                        'GET /api/v1/hybrid/cloudbridge/providers': 'List cloud providers',
                        'POST /api/v1/hybrid/cloudbridge/providers': 'Register provider',
                        'GET /api/v1/hybrid/cloudbridge/accounts': 'List cloud accounts',
                        'POST /api/v1/hybrid/cloudbridge/accounts': 'Create account',
                        'POST /api/v1/hybrid/cloudbridge/discover': 'Discover resources',
                        'GET /api/v1/hybrid/cloudbridge/workloads': 'List workloads',
                        'POST /api/v1/hybrid/cloudbridge/workloads': 'Create workload',
                        'POST /api/v1/hybrid/cloudbridge/migrate': 'Migrate workload',
                        'GET /api/v1/hybrid/cloudbridge/costs': 'Analyze costs',
                        'GET /api/v1/hybrid/cloudbridge/dashboard': 'Get unified dashboard'
                    },
                    enterprise: {
                        'GET /api/v1/enterprise/enterpriseguard/frameworks': 'List compliance frameworks',
                        'POST /api/v1/enterprise/enterpriseguard/frameworks': 'Setup framework',
                        'GET /api/v1/enterprise/enterpriseguard/audits': 'List audits',
                        'POST /api/v1/enterprise/enterpriseguard/audits': 'Create audit',
                        'GET /api/v1/enterprise/enterpriseguard/policies': 'List policies',
                        'POST /api/v1/enterprise/enterpriseguard/policies': 'Create policy',
                        'GET /api/v1/enterprise/enterpriseguard/incidents': 'List incidents',
                        'POST /api/v1/enterprise/enterpriseguard/incidents': 'Create incident',
                        'GET /api/v1/enterprise/enterpriseguard/tickets': 'List support tickets',
                        'POST /api/v1/enterprise/enterpriseguard/tickets': 'Create ticket',
                        'GET /api/v1/enterprise/enterpriseguard/dashboard': 'Get compliance dashboard'
                    },
                    analytics: {
                        'GET /api/v1/analytics/datastream/streams': 'List data streams',
                        'POST /api/v1/analytics/datastream/streams': 'Create data stream',
                        'POST /api/v1/analytics/datastream/records': 'Put record to stream',
                        'GET /api/v1/analytics/datastream/records': 'Get records from stream',
                        'GET /api/v1/analytics/datastream/processors': 'List stream processors',
                        'POST /api/v1/analytics/datastream/processors': 'Create stream processor',
                        'PUT /api/v1/analytics/datastream/processors/start': 'Start processor',
                        'PUT /api/v1/analytics/datastream/processors/stop': 'Stop processor',
                        'POST /api/v1/analytics/datastream/query': 'Execute analytics query',
                        'GET /api/v1/analytics/insightforge/dashboards': 'List BI dashboards',
                        'POST /api/v1/analytics/insightforge/dashboards': 'Create dashboard',
                        'PUT /api/v1/analytics/insightforge/dashboards': 'Update dashboard',
                        'GET /api/v1/analytics/insightforge/reports': 'List reports',
                        'POST /api/v1/analytics/insightforge/reports': 'Create report',
                        'POST /api/v1/analytics/insightforge/reports/generate': 'Generate report',
                        'GET /api/v1/analytics/insightforge/datasets': 'List datasets',
                        'POST /api/v1/analytics/insightforge/datasets': 'Create dataset',
                        'POST /api/v1/analytics/insightforge/datasets/process': 'Process dataset',
                        'GET /api/v1/analytics/insightforge/visualizations': 'List visualizations',
                        'POST /api/v1/analytics/insightforge/visualizations': 'Create visualization',
                        'POST /api/v1/analytics/insightforge/visualizations/render': 'Render visualization',
                        'POST /api/v1/analytics/insightforge/query': 'Execute BI query'
                    }
                },
                authentication: {
                    type: 'API Key',
                    header: 'X-API-Key',
                    description: 'Include your API key in the X-API-Key header'
                }
            });
        });

        // API key management endpoints
        this.app.post('/api/v1/auth/keys', (req, res) => {
            try {
                const result = this.serviceManager.createApiKey(req.body);
                res.json(result);
            } catch (error) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 400,
                        message: error.message
                    }
                });
            }
        });

        // Main API routes
        this.app.all('/api/v1/*', async (req, res) => {
            try {
                const result = await this.serviceManager.handleRequest(
                    req.method,
                    req.path,
                    req.headers,
                    req.body,
                    req.query
                );
                
                res.status(result.success ? 200 : result.error?.code || 500).json(result);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: {
                        code: 500,
                        message: error.message
                    }
                });
            }
        });

        // Audit logs endpoint
        this.app.get('/api/v1/admin/audit-logs', (req, res) => {
            try {
                const result = this.serviceManager.getAuditLogs(req.query);
                res.json(result);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: {
                        code: 500,
                        message: error.message
                    }
                });
            }
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: {
                    code: 404,
                    message: 'Endpoint not found'
                }
            });
        });

        // Error handler
        this.app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 500,
                    message: 'Internal server error'
                }
            });
        });
    }

    /**
     * Start the server
     */
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.config.port, this.config.host, () => {
                    console.log(`VPS-PK Cloud API Server running on http://${this.config.host}:${this.config.port}`);
                    console.log(`Health check: http://${this.config.host}:${this.config.port}/health`);
                    console.log(`API Documentation: http://${this.config.host}:${this.config.port}/docs`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Stop the server
     */
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('VPS-PK Cloud API Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Get server info
     */
    getServerInfo() {
        return {
            port: this.config.port,
            host: this.config.host,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid,
            version: process.version,
            platform: process.platform
        };
    }
}

// CLI interface
if (require.main === module) {
    const server = new VPSPKAPIServer({
        port: process.env.PORT || 3000,
        host: process.env.HOST || '0.0.0.0'
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        await server.stop();
        process.exit(0);
    });

    // Start server
    server.start().catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = VPSPKAPIServer;
