/**
 * SkyNet - Global Content Delivery Network
 * High-performance CDN with global edge locations for content acceleration
 */

class SkyNet {
    constructor(config = {}) {
        this.config = {
            region: config.region || 'us-east-1',
            defaultTTL: config.defaultTTL || 3600,
            maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
            enableCompression: config.enableCompression || true,
            enableHTTP2: config.enableHTTP2 || true,
            enableWebP: config.enableWebP || true,
            ...config
        };
        
        this.distributions = new Map();
        this.edgeLocations = new Map();
        this.cache = new Map();
        this.metrics = {
            totalDistributions: 0,
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            bandwidthUsed: 0,
            averageResponseTime: 0
        };
        
        this.initializeEdgeLocations();
    }

    /**
     * Initialize global edge locations
     */
    initializeEdgeLocations() {
        const locations = [
            { id: 'us-east-1', name: 'US East (N. Virginia)', lat: 39.0438, lon: -77.4874 },
            { id: 'us-west-2', name: 'US West (Oregon)', lat: 45.5152, lon: -122.6784 },
            { id: 'eu-west-1', name: 'Europe (Ireland)', lat: 53.3498, lon: -6.2603 },
            { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', lat: 1.3521, lon: 103.8198 },
            { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', lat: 35.6762, lon: 139.6503 },
            { id: 'sa-east-1', name: 'South America (São Paulo)', lat: -23.5505, lon: -46.6333 },
            { id: 'af-south-1', name: 'Africa (Cape Town)', lat: -33.9249, lon: 18.4241 },
            { id: 'me-south-1', name: 'Middle East (Bahrain)', lat: 26.0667, lon: 50.5577 }
        ];

        locations.forEach(location => {
            this.edgeLocations.set(location.id, {
                ...location,
                cache: new Map(),
                metrics: {
                    requests: 0,
                    cacheHits: 0,
                    bandwidthUsed: 0,
                    averageResponseTime: 0
                }
            });
        });
    }

    /**
     * Create a new CDN distribution
     */
    async createDistribution(distributionConfig) {
        const distributionId = this.generateDistributionId();
        const distribution = {
            id: distributionId,
            domainName: distributionConfig.domainName || `d${distributionId}.skynet.com`,
            origin: {
                domainName: distributionConfig.origin.domainName,
                path: distributionConfig.origin.path || '',
                protocol: distributionConfig.origin.protocol || 'https',
                port: distributionConfig.origin.port || 443
            },
            status: 'creating',
            createdAt: new Date(),
            enabled: distributionConfig.enabled !== false,
            comment: distributionConfig.comment || '',
            defaultRootObject: distributionConfig.defaultRootObject || 'index.html',
            priceClass: distributionConfig.priceClass || 'PriceClass_All',
            webACLId: distributionConfig.webACLId,
            httpVersion: distributionConfig.httpVersion || 'http2',
            isIPV6Enabled: distributionConfig.isIPV6Enabled || true,
            aliases: distributionConfig.aliases || [],
            sslCertificate: distributionConfig.sslCertificate,
            customErrorResponses: distributionConfig.customErrorResponses || [],
            defaultCacheBehavior: {
                targetOriginId: distributionId,
                viewerProtocolPolicy: distributionConfig.viewerProtocolPolicy || 'redirect-to-https',
                allowedMethods: distributionConfig.allowedMethods || ['GET', 'HEAD', 'OPTIONS'],
                cachedMethods: distributionConfig.cachedMethods || ['GET', 'HEAD'],
                compress: distributionConfig.compress || this.config.enableCompression,
                ttl: distributionConfig.ttl || this.config.defaultTTL,
                forwardedValues: {
                    queryString: distributionConfig.queryString || false,
                    cookies: distributionConfig.cookies || 'none',
                    headers: distributionConfig.headers || []
                }
            },
            cacheBehaviors: distributionConfig.cacheBehaviors || [],
            restrictions: distributionConfig.restrictions || {},
            tags: distributionConfig.tags || {},
            metrics: {
                requests: 0,
                cacheHits: 0,
                bandwidthUsed: 0,
                averageResponseTime: 0
            }
        };

        this.distributions.set(distributionId, distribution);
        
        // Simulate distribution creation
        await this.simulateDistributionCreation(distribution);
        
        this.updateMetrics();
        
        return {
            success: true,
            distributionId,
            distribution,
            message: 'CDN distribution created successfully'
        };
    }

    /**
     * Invalidate cache for specific paths
     */
    async invalidateCache(distributionId, paths) {
        const distribution = this.distributions.get(distributionId);
        if (!distribution) {
            throw new Error(`Distribution ${distributionId} not found`);
        }

        const invalidationId = this.generateInvalidationId();
        const invalidation = {
            id: invalidationId,
            distributionId,
            paths: Array.isArray(paths) ? paths : [paths],
            status: 'in-progress',
            createdAt: new Date(),
            callerReference: `invalidation-${invalidationId}`
        };

        // Simulate invalidation process
        await this.simulateInvalidation(invalidation);
        
        return {
            success: true,
            invalidationId,
            invalidation,
            message: 'Cache invalidation initiated successfully'
        };
    }

    /**
     * Serve content through CDN
     */
    async serveContent(distributionId, path, requestHeaders = {}) {
        const distribution = this.distributions.get(distributionId);
        if (!distribution) {
            throw new Error(`Distribution ${distributionId} not found`);
        }

        if (!distribution.enabled) {
            throw new Error('Distribution is disabled');
        }

        const startTime = Date.now();
        const edgeLocation = this.selectEdgeLocation(requestHeaders);
        
        // Check cache first
        const cacheKey = `${distributionId}:${path}`;
        const cachedContent = this.getCachedContent(edgeLocation.id, cacheKey);
        
        if (cachedContent) {
            // Cache hit
            this.updateCacheMetrics(edgeLocation.id, true);
            this.updateDistributionMetrics(distributionId, true, Date.now() - startTime);
            
            return {
                success: true,
                content: cachedContent.content,
                headers: {
                    ...cachedContent.headers,
                    'X-Cache': 'HIT',
                    'X-Cache-Location': edgeLocation.id,
                    'X-Served-By': 'SkyNet-CDN'
                },
                fromCache: true,
                responseTime: Date.now() - startTime
            };
        }

        // Cache miss - fetch from origin
        const originContent = await this.fetchFromOrigin(distribution, path, requestHeaders);
        
        // Cache the content
        this.cacheContent(edgeLocation.id, cacheKey, originContent, distribution.defaultCacheBehavior.ttl);
        
        // Update metrics
        this.updateCacheMetrics(edgeLocation.id, false);
        this.updateDistributionMetrics(distributionId, false, Date.now() - startTime);
        
        return {
            success: true,
            content: originContent.content,
            headers: {
                ...originContent.headers,
                'X-Cache': 'MISS',
                'X-Cache-Location': edgeLocation.id,
                'X-Served-By': 'SkyNet-CDN'
            },
            fromCache: false,
            responseTime: Date.now() - startTime
        };
    }

    /**
     * Get distribution details
     */
    getDistribution(distributionId) {
        const distribution = this.distributions.get(distributionId);
        if (!distribution) {
            throw new Error(`Distribution ${distributionId} not found`);
        }

        return {
            success: true,
            distribution: {
                ...distribution,
                metrics: this.getDistributionMetrics(distributionId)
            }
        };
    }

    /**
     * List all distributions
     */
    listDistributions() {
        const distributions = Array.from(this.distributions.values()).map(distribution => ({
            ...distribution,
            metrics: this.getDistributionMetrics(distribution.id)
        }));

        return {
            success: true,
            distributions,
            total: distributions.length
        };
    }

    /**
     * Update distribution configuration
     */
    async updateDistribution(distributionId, updates) {
        const distribution = this.distributions.get(distributionId);
        if (!distribution) {
            throw new Error(`Distribution ${distributionId} not found`);
        }

        // Apply updates
        Object.keys(updates).forEach(key => {
            if (updates[key] !== undefined) {
                distribution[key] = updates[key];
            }
        });

        distribution.lastModified = new Date();
        
        // Simulate update process
        await this.simulateOperation(2000);
        
        return {
            success: true,
            distributionId,
            distribution,
            message: 'Distribution updated successfully'
        };
    }

    /**
     * Delete a distribution
     */
    async deleteDistribution(distributionId) {
        const distribution = this.distributions.get(distributionId);
        if (!distribution) {
            throw new Error(`Distribution ${distributionId} not found`);
        }

        // Disable distribution first
        distribution.enabled = false;
        distribution.status = 'deleting';
        
        // Simulate deletion process
        await this.simulateOperation(5000);
        
        // Clear cache
        this.clearDistributionCache(distributionId);
        
        // Delete distribution
        this.distributions.delete(distributionId);
        this.updateMetrics();
        
        return {
            success: true,
            distributionId,
            message: 'Distribution deleted successfully'
        };
    }

    /**
     * Get CDN metrics
     */
    getMetrics() {
        return {
            success: true,
            metrics: {
                ...this.metrics,
                cacheHitRatio: this.metrics.totalRequests > 0 ? 
                    (this.metrics.cacheHits / this.metrics.totalRequests) * 100 : 0,
                edgeLocations: Array.from(this.edgeLocations.values()).map(location => ({
                    id: location.id,
                    name: location.name,
                    metrics: location.metrics
                }))
            }
        };
    }

    // Helper methods
    generateDistributionId() {
        return `E${Math.random().toString(36).substr(2, 13).toUpperCase()}`;
    }

    generateInvalidationId() {
        return `I${Math.random().toString(36).substr(2, 13).toUpperCase()}`;
    }

    selectEdgeLocation(requestHeaders) {
        // Simple edge location selection based on user location
        // In a real implementation, this would use GeoIP
        const locations = Array.from(this.edgeLocations.values());
        return locations[Math.floor(Math.random() * locations.length)];
    }

    getCachedContent(edgeLocationId, cacheKey) {
        const location = this.edgeLocations.get(edgeLocationId);
        if (!location) return null;
        
        const cached = location.cache.get(cacheKey);
        if (!cached) return null;
        
        // Check if cache entry is expired
        if (Date.now() > cached.expiresAt) {
            location.cache.delete(cacheKey);
            return null;
        }
        
        return cached;
    }

    cacheContent(edgeLocationId, cacheKey, content, ttl) {
        const location = this.edgeLocations.get(edgeLocationId);
        if (!location) return;
        
        location.cache.set(cacheKey, {
            content: content.content,
            headers: content.headers,
            cachedAt: Date.now(),
            expiresAt: Date.now() + (ttl * 1000)
        });
        
        // Limit cache size
        if (location.cache.size > 10000) {
            const firstKey = location.cache.keys().next().value;
            location.cache.delete(firstKey);
        }
    }

    async fetchFromOrigin(distribution, path, requestHeaders) {
        // Simulate fetching from origin
        await this.simulateOperation(100 + Math.random() * 200);
        
        return {
            content: `Content for ${path}`,
            headers: {
                'Content-Type': 'text/html',
                'Content-Length': '1024',
                'Last-Modified': new Date().toUTCString(),
                'ETag': `"${Math.random().toString(36).substr(2, 16)}"`
            }
        };
    }

    clearDistributionCache(distributionId) {
        const cacheKeyPrefix = `${distributionId}:`;
        
        this.edgeLocations.forEach(location => {
            const keysToDelete = [];
            location.cache.forEach((value, key) => {
                if (key.startsWith(cacheKeyPrefix)) {
                    keysToDelete.push(key);
                }
            });
            
            keysToDelete.forEach(key => location.cache.delete(key));
        });
    }

    updateCacheMetrics(edgeLocationId, isHit) {
        const location = this.edgeLocations.get(edgeLocationId);
        if (!location) return;
        
        location.metrics.requests++;
        if (isHit) {
            location.metrics.cacheHits++;
        }
        
        this.metrics.totalRequests++;
        if (isHit) {
            this.metrics.cacheHits++;
        } else {
            this.metrics.cacheMisses++;
        }
    }

    updateDistributionMetrics(distributionId, isHit, responseTime) {
        const distribution = this.distributions.get(distributionId);
        if (!distribution) return;
        
        distribution.metrics.requests++;
        if (isHit) {
            distribution.metrics.cacheHits++;
        }
        
        // Update average response time
        distribution.metrics.averageResponseTime = 
            (distribution.metrics.averageResponseTime * (distribution.metrics.requests - 1) + responseTime) / 
            distribution.metrics.requests;
        
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
            this.metrics.totalRequests;
    }

    getDistributionMetrics(distributionId) {
        const distribution = this.distributions.get(distributionId);
        if (!distribution) return null;
        
        return {
            ...distribution.metrics,
            cacheHitRatio: distribution.metrics.requests > 0 ? 
                (distribution.metrics.cacheHits / distribution.metrics.requests) * 100 : 0
        };
    }

    async simulateDistributionCreation(distribution) {
        await this.simulateOperation(10000);
        distribution.status = 'deployed';
    }

    async simulateInvalidation(invalidation) {
        await this.simulateOperation(5000);
        invalidation.status = 'completed';
    }

    async simulateOperation(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    updateMetrics() {
        this.metrics.totalDistributions = this.distributions.size;
    }
}

module.exports = SkyNet;
