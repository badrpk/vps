/**
 * ApiStar - API Management & Gateway Platform
 * Comprehensive API management with gateway, analytics, and developer portal
 */

class ApiStar {
    constructor(config = {}) {
        this.config = {
            region: config.region || 'us-east-1',
            defaultRateLimit: config.defaultRateLimit || 1000,
            enableAnalytics: config.enableAnalytics || true,
            enableCaching: config.enableCaching || true,
            enableThrottling: config.enableThrottling || true,
            ...config
        };
        
        this.apis = new Map();
        this.gateways = new Map();
        this.plans = new Map();
        this.subscriptions = new Map();
        this.keys = new Map();
        this.usage = new Map();
        this.analytics = new Map();
        this.cache = new Map();
        
        this.metrics = {
            totalAPIs: 0,
            totalGateways: 0,
            totalSubscriptions: 0,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            cacheHitRate: 0
        };
    }

    /**
     * Create a new API
     */
    async createAPI(apiConfig) {
        const apiId = this.generateAPIId();
        const api = {
            id: apiId,
            name: apiConfig.name || `api-${apiId}`,
            description: apiConfig.description || '',
            version: apiConfig.version || '1.0.0',
            basePath: apiConfig.basePath || '/',
            protocols: apiConfig.protocols || ['https'],
            endpoints: apiConfig.endpoints || [],
            authentication: apiConfig.authentication || 'api-key',
            rateLimit: apiConfig.rateLimit || this.config.defaultRateLimit,
            caching: apiConfig.caching || false,
            tags: apiConfig.tags || {},
            createdAt: new Date(),
            status: 'active',
            metrics: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0
            }
        };

        this.apis.set(apiId, api);
        this.updateMetrics();
        
        return {
            success: true,
            apiId,
            api,
            message: 'API created successfully'
        };
    }

    /**
     * Create API Gateway
     */
    async createGateway(gatewayConfig) {
        const gatewayId = this.generateGatewayId();
        const gateway = {
            id: gatewayId,
            name: gatewayConfig.name || `gateway-${gatewayId}`,
            description: gatewayConfig.description || '',
            region: gatewayConfig.region || this.config.region,
            apis: gatewayConfig.apis || [],
            customDomain: gatewayConfig.customDomain,
            sslCertificate: gatewayConfig.sslCertificate,
            tags: gatewayConfig.tags || {},
            createdAt: new Date(),
            status: 'active',
            metrics: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                averageResponseTime: 0
            }
        };

        this.gateways.set(gatewayId, gateway);
        this.updateMetrics();
        
        return {
            success: true,
            gatewayId,
            gateway,
            message: 'Gateway created successfully'
        };
    }

    /**
     * Process API request through gateway
     */
    async processRequest(gatewayId, request) {
        const gateway = this.gateways.get(gatewayId);
        if (!gateway) {
            throw new Error(`Gateway ${gatewayId} not found`);
        }

        const startTime = Date.now();
        
        // Find matching API
        const api = this.findMatchingAPI(gateway, request.path, request.method);
        if (!api) {
            throw new Error('No matching API found');
        }

        // Check authentication
        if (!this.authenticateRequest(request, api)) {
            throw new Error('Authentication failed');
        }

        // Check rate limiting
        if (!this.checkRateLimit(request, api)) {
            throw new Error('Rate limit exceeded');
        }

        // Check cache
        const cacheKey = this.generateCacheKey(request);
        const cachedResponse = this.getCachedResponse(cacheKey);
        if (cachedResponse) {
            this.metrics.cacheHitRate = 
                (this.metrics.cacheHitRate * this.metrics.totalRequests + 1) / 
                (this.metrics.totalRequests + 1);
            
            return {
                success: true,
                data: cachedResponse,
                fromCache: true,
                responseTime: Date.now() - startTime
            };
        }

        // Process request
        const response = await this.executeAPIRequest(api, request);
        
        // Cache response if enabled
        if (api.caching) {
            this.cacheResponse(cacheKey, response);
        }

        // Update metrics
        this.updateRequestMetrics(api, gateway, Date.now() - startTime, true);
        
        return {
            success: true,
            data: response,
            fromCache: false,
            responseTime: Date.now() - startTime
        };
    }

    /**
     * Create usage plan
     */
    async createUsagePlan(planConfig) {
        const planId = this.generatePlanId();
        const plan = {
            id: planId,
            name: planConfig.name || `plan-${planId}`,
            description: planConfig.description || '',
            throttle: planConfig.throttle || {
                rateLimit: 1000,
                burstLimit: 2000
            },
            quota: planConfig.quota || {
                limit: 10000,
                period: 'DAY'
            },
            apis: planConfig.apis || [],
            tags: planConfig.tags || {},
            createdAt: new Date(),
            status: 'active'
        };

        this.plans.set(planId, plan);
        
        return {
            success: true,
            planId,
            plan,
            message: 'Usage plan created successfully'
        };
    }

    /**
     * Subscribe to usage plan
     */
    async subscribeToPlan(planId, subscriptionConfig) {
        const plan = this.plans.get(planId);
        if (!plan) {
            throw new Error(`Usage plan ${planId} not found`);
        }

        const subscriptionId = this.generateSubscriptionId();
        const subscription = {
            id: subscriptionId,
            planId,
            subscriberId: subscriptionConfig.subscriberId,
            subscriberType: subscriptionConfig.subscriberType || 'user',
            apiKey: this.generateAPIKey(),
            createdAt: new Date(),
            status: 'active',
            usage: {
                requests: 0,
                quotaUsed: 0,
                lastReset: new Date()
            }
        };

        this.subscriptions.set(subscriptionId, subscription);
        this.keys.set(subscription.apiKey, subscriptionId);
        this.updateMetrics();
        
        return {
            success: true,
            subscriptionId,
            subscription,
            message: 'Subscription created successfully'
        };
    }

    /**
     * Get API analytics
     */
    getAnalytics(apiId, timeRange = '24h') {
        const api = this.apis.get(apiId);
        if (!api) {
            throw new Error(`API ${apiId} not found`);
        }

        const analytics = {
            apiId,
            timeRange,
            metrics: {
                totalRequests: api.metrics.totalRequests,
                successfulRequests: api.metrics.successfulRequests,
                failedRequests: api.metrics.failedRequests,
                averageResponseTime: api.metrics.averageResponseTime,
                successRate: api.metrics.totalRequests > 0 ? 
                    (api.metrics.successfulRequests / api.metrics.totalRequests) * 100 : 0
            },
            timeSeries: this.generateTimeSeriesData(apiId, timeRange),
            topEndpoints: this.getTopEndpoints(apiId),
            errorAnalysis: this.getErrorAnalysis(apiId)
        };

        return {
            success: true,
            analytics
        };
    }

    /**
     * Get API details
     */
    getAPI(apiId) {
        const api = this.apis.get(apiId);
        if (!api) {
            throw new Error(`API ${apiId} not found`);
        }

        return {
            success: true,
            api: {
                ...api,
                subscriptions: this.getAPISubscriptions(apiId),
                analytics: this.getAnalytics(apiId).analytics
            }
        };
    }

    /**
     * List all APIs
     */
    listAPIs() {
        const apis = Array.from(this.apis.values()).map(api => ({
            ...api,
            subscriptions: this.getAPISubscriptions(api.id).length
        }));

        return {
            success: true,
            apis,
            total: apis.length
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
                apiSuccessRate: this.metrics.totalRequests > 0 ? 
                    (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 : 0
            }
        };
    }

    // Helper methods
    generateAPIId() {
        return `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateGatewayId() {
        return `gateway-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generatePlanId() {
        return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateSubscriptionId() {
        return `subscription-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateAPIKey() {
        return `apikey_${Math.random().toString(36).substr(2, 32)}`;
    }

    findMatchingAPI(gateway, path, method) {
        for (const apiId of gateway.apis) {
            const api = this.apis.get(apiId);
            if (api && this.pathMatches(path, api.basePath)) {
                return api;
            }
        }
        return null;
    }

    pathMatches(requestPath, apiBasePath) {
        return requestPath.startsWith(apiBasePath);
    }

    authenticateRequest(request, api) {
        if (api.authentication === 'none') return true;
        
        const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');
        return this.keys.has(apiKey);
    }

    checkRateLimit(request, api) {
        const apiKey = request.headers['x-api-key'];
        if (!apiKey) return true;
        
        const subscriptionId = this.keys.get(apiKey);
        if (!subscriptionId) return true;
        
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) return true;
        
        // Simple rate limiting check
        return subscription.usage.requests < 1000; // Simplified
    }

    generateCacheKey(request) {
        return `${request.method}:${request.path}:${JSON.stringify(request.query)}`;
    }

    getCachedResponse(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
        return null;
    }

    cacheResponse(cacheKey, data) {
        this.cache.set(cacheKey, {
            data,
            expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
        });
    }

    async executeAPIRequest(api, request) {
        // Simulate API execution
        await this.simulateOperation(100 + Math.random() * 500);
        
        return {
            message: 'API response',
            data: { requestId: Math.random().toString(36).substr(2, 9) },
            timestamp: new Date()
        };
    }

    updateRequestMetrics(api, gateway, responseTime, success) {
        api.metrics.totalRequests++;
        gateway.metrics.totalRequests++;
        this.metrics.totalRequests++;
        
        if (success) {
            api.metrics.successfulRequests++;
            gateway.metrics.successfulRequests++;
            this.metrics.successfulRequests++;
        } else {
            api.metrics.failedRequests++;
            gateway.metrics.failedRequests++;
            this.metrics.failedRequests++;
        }
        
        // Update average response time
        api.metrics.averageResponseTime = 
            (api.metrics.averageResponseTime * (api.metrics.totalRequests - 1) + responseTime) / 
            api.metrics.totalRequests;
    }

    generateTimeSeriesData(apiId, timeRange) {
        // Generate mock time series data
        const points = [];
        const now = Date.now();
        const interval = timeRange === '24h' ? 3600000 : 300000; // 1 hour or 5 minutes
        
        for (let i = 23; i >= 0; i--) {
            points.push({
                timestamp: new Date(now - (i * interval)),
                requests: Math.floor(Math.random() * 100),
                errors: Math.floor(Math.random() * 10),
                responseTime: Math.random() * 1000
            });
        }
        
        return points;
    }

    getTopEndpoints(apiId) {
        return [
            { endpoint: '/users', requests: 1250, errors: 5 },
            { endpoint: '/orders', requests: 980, errors: 12 },
            { endpoint: '/products', requests: 750, errors: 3 }
        ];
    }

    getErrorAnalysis(apiId) {
        return {
            totalErrors: 20,
            errorTypes: [
                { type: 'Authentication', count: 8 },
                { type: 'Rate Limit', count: 6 },
                { type: 'Validation', count: 4 },
                { type: 'Server Error', count: 2 }
            ]
        };
    }

    getAPISubscriptions(apiId) {
        return Array.from(this.subscriptions.values())
            .filter(sub => sub.status === 'active');
    }

    async simulateOperation(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    updateMetrics() {
        this.metrics.totalAPIs = this.apis.size;
        this.metrics.totalGateways = this.gateways.size;
        this.metrics.totalSubscriptions = this.subscriptions.size;
    }
}

module.exports = ApiStar;
