/**
 * MoonVault - Secure Object Storage
 * Scalable object storage for unstructured data with advanced security features
 */

class MoonVault {
    constructor(config = {}) {
        this.config = {
            region: config.region || 'us-east-1',
            encryptionEnabled: config.encryptionEnabled || true,
            versioningEnabled: config.versioningEnabled || false,
            lifecycleEnabled: config.lifecycleEnabled || true,
            replicationEnabled: config.replicationEnabled || false,
            ...config
        };
        
        this.buckets = new Map();
        this.objects = new Map();
        this.metrics = {
            totalBuckets: 0,
            totalObjects: 0,
            totalSize: 0,
            totalRequests: 0
        };
        
        this.lifecycleRules = new Map();
        this.replicationRules = new Map();
    }

    /**
     * Create a new bucket
     */
    async createBucket(bucketConfig) {
        const bucketName = bucketConfig.name || this.generateBucketName();
        
        if (this.buckets.has(bucketName)) {
            throw new Error(`Bucket ${bucketName} already exists`);
        }

        const bucket = {
            name: bucketName,
            region: bucketConfig.region || this.config.region,
            createdAt: new Date(),
            versioning: bucketConfig.versioning || this.config.versioningEnabled,
            encryption: bucketConfig.encryption || this.config.encryptionEnabled,
            lifecycle: bucketConfig.lifecycle || this.config.lifecycleEnabled,
            replication: bucketConfig.replication || this.config.replicationEnabled,
            cors: bucketConfig.cors || [],
            notification: bucketConfig.notification || {},
            tags: bucketConfig.tags || {},
            accessControl: bucketConfig.accessControl || 'private',
            metrics: {
                objectCount: 0,
                totalSize: 0,
                lastModified: new Date()
            }
        };

        this.buckets.set(bucketName, bucket);
        this.updateMetrics();
        
        return {
            success: true,
            bucketName,
            bucket,
            message: 'Bucket created successfully'
        };
    }

    /**
     * Upload an object to a bucket
     */
    async uploadObject(bucketName, objectKey, data, options = {}) {
        const bucket = this.buckets.get(bucketName);
        if (!bucket) {
            throw new Error(`Bucket ${bucketName} not found`);
        }

        const objectId = this.generateObjectId();
        const object = {
            id: objectId,
            bucketName,
            key: objectKey,
            size: data.length || data.size || 0,
            contentType: options.contentType || 'application/octet-stream',
            lastModified: new Date(),
            etag: this.generateETag(data),
            metadata: options.metadata || {},
            tags: options.tags || {},
            encryption: bucket.encryption ? {
                algorithm: 'AES256',
                keyId: options.keyId || 'default'
            } : null,
            version: bucket.versioning ? this.generateVersion() : null,
            storageClass: options.storageClass || 'STANDARD',
            accessControl: options.accessControl || bucket.accessControl,
            checksum: this.calculateChecksum(data)
        };

        // Store object data
        this.objects.set(objectId, object);
        
        // Update bucket metrics
        bucket.metrics.objectCount++;
        bucket.metrics.totalSize += object.size;
        bucket.metrics.lastModified = object.lastModified;
        
        this.updateMetrics();
        
        // Apply lifecycle rules
        await this.applyLifecycleRules(bucketName, object);
        
        return {
            success: true,
            objectId,
            object: {
                bucketName: object.bucketName,
                key: object.key,
                etag: object.etag,
                size: object.size,
                lastModified: object.lastModified,
                version: object.version
            },
            message: 'Object uploaded successfully'
        };
    }

    /**
     * Download an object from a bucket
     */
    async downloadObject(bucketName, objectKey, version = null) {
        const bucket = this.buckets.get(bucketName);
        if (!bucket) {
            throw new Error(`Bucket ${bucketName} not found`);
        }

        // Find object by key and version
        const object = this.findObjectByKey(bucketName, objectKey, version);
        if (!object) {
            throw new Error(`Object ${objectKey} not found`);
        }

        // Check access permissions
        if (!this.hasAccess(object, 'read')) {
            throw new Error('Access denied');
        }

        // Update access metrics
        this.metrics.totalRequests++;
        
        return {
            success: true,
            object: {
                bucketName: object.bucketName,
                key: object.key,
                size: object.size,
                contentType: object.contentType,
                lastModified: object.lastModified,
                etag: object.etag,
                metadata: object.metadata,
                version: object.version,
                checksum: object.checksum
            },
            message: 'Object downloaded successfully'
        };
    }

    /**
     * Delete an object from a bucket
     */
    async deleteObject(bucketName, objectKey, version = null) {
        const bucket = this.buckets.get(bucketName);
        if (!bucket) {
            throw new Error(`Bucket ${bucketName} not found`);
        }

        const object = this.findObjectByKey(bucketName, objectKey, version);
        if (!object) {
            throw new Error(`Object ${objectKey} not found`);
        }

        // Check access permissions
        if (!this.hasAccess(object, 'delete')) {
            throw new Error('Access denied');
        }

        // Update bucket metrics
        bucket.metrics.objectCount--;
        bucket.metrics.totalSize -= object.size;
        
        // Delete object
        this.objects.delete(object.id);
        this.updateMetrics();
        
        return {
            success: true,
            objectKey,
            version: object.version,
            message: 'Object deleted successfully'
        };
    }

    /**
     * List objects in a bucket
     */
    listObjects(bucketName, options = {}) {
        const bucket = this.buckets.get(bucketName);
        if (!bucket) {
            throw new Error(`Bucket ${bucketName} not found`);
        }

        let objects = Array.from(this.objects.values())
            .filter(obj => obj.bucketName === bucketName);

        // Apply filters
        if (options.prefix) {
            objects = objects.filter(obj => obj.key.startsWith(options.prefix));
        }

        if (options.delimiter) {
            // Implement delimiter logic for folder-like structure
            const folders = new Set();
            objects = objects.filter(obj => {
                const keyParts = obj.key.split(options.delimiter);
                if (keyParts.length > 1) {
                    folders.add(keyParts[0] + options.delimiter);
                    return false;
                }
                return true;
            });
            
            // Add folder markers
            objects = objects.concat(Array.from(folders).map(folder => ({
                key: folder,
                isFolder: true,
                lastModified: new Date()
            })));
        }

        // Sort by key
        objects.sort((a, b) => a.key.localeCompare(b.key));

        // Apply pagination
        const maxKeys = options.maxKeys || 1000;
        const startIndex = options.startAfter ? 
            objects.findIndex(obj => obj.key > options.startAfter) : 0;
        
        const paginatedObjects = objects.slice(startIndex, startIndex + maxKeys);
        const isTruncated = startIndex + maxKeys < objects.length;

        return {
            success: true,
            objects: paginatedObjects.map(obj => ({
                key: obj.key,
                size: obj.size || 0,
                lastModified: obj.lastModified,
                etag: obj.etag,
                storageClass: obj.storageClass,
                version: obj.version,
                isFolder: obj.isFolder || false
            })),
            isTruncated,
            nextStartAfter: isTruncated ? paginatedObjects[paginatedObjects.length - 1].key : null
        };
    }

    /**
     * Copy an object within or between buckets
     */
    async copyObject(sourceBucket, sourceKey, destBucket, destKey, options = {}) {
        const sourceObject = this.findObjectByKey(sourceBucket, sourceKey);
        if (!sourceObject) {
            throw new Error(`Source object ${sourceKey} not found`);
        }

        const destBucketObj = this.buckets.get(destBucket);
        if (!destBucketObj) {
            throw new Error(`Destination bucket ${destBucket} not found`);
        }

        // Create copy with new metadata
        const copyOptions = {
            contentType: options.contentType || sourceObject.contentType,
            metadata: { ...sourceObject.metadata, ...options.metadata },
            tags: { ...sourceObject.tags, ...options.tags },
            storageClass: options.storageClass || sourceObject.storageClass
        };

        return await this.uploadObject(destBucket, destKey, 
            { size: sourceObject.size }, copyOptions);
    }

    /**
     * Get object metadata
     */
    getObjectMetadata(bucketName, objectKey, version = null) {
        const object = this.findObjectByKey(bucketName, objectKey, version);
        if (!object) {
            throw new Error(`Object ${objectKey} not found`);
        }

        return {
            success: true,
            metadata: {
                bucketName: object.bucketName,
                key: object.key,
                size: object.size,
                contentType: object.contentType,
                lastModified: object.lastModified,
                etag: object.etag,
                metadata: object.metadata,
                tags: object.tags,
                version: object.version,
                storageClass: object.storageClass,
                checksum: object.checksum,
                encryption: object.encryption
            }
        };
    }

    /**
     * Set bucket lifecycle rules
     */
    async setLifecycleRules(bucketName, rules) {
        const bucket = this.buckets.get(bucketName);
        if (!bucket) {
            throw new Error(`Bucket ${bucketName} not found`);
        }

        const lifecycleId = this.generateLifecycleId();
        const lifecycleRule = {
            id: lifecycleId,
            bucketName,
            rules: rules.map(rule => ({
                id: rule.id || this.generateRuleId(),
                status: rule.status || 'Enabled',
                filter: rule.filter || {},
                transitions: rule.transitions || [],
                expiration: rule.expiration || null,
                noncurrentVersionTransitions: rule.noncurrentVersionTransitions || [],
                noncurrentVersionExpiration: rule.noncurrentVersionExpiration || null
            })),
            createdAt: new Date()
        };

        this.lifecycleRules.set(lifecycleId, lifecycleRule);
        
        return {
            success: true,
            lifecycleId,
            message: 'Lifecycle rules set successfully'
        };
    }

    /**
     * Apply lifecycle rules to an object
     */
    async applyLifecycleRules(bucketName, object) {
        const lifecycleRule = Array.from(this.lifecycleRules.values())
            .find(rule => rule.bucketName === bucketName);
        
        if (!lifecycleRule) return;

        for (const rule of lifecycleRule.rules) {
            if (rule.status === 'Enabled' && this.matchesFilter(object, rule.filter)) {
                // Apply transitions and expiration rules
                await this.processLifecycleRule(object, rule);
            }
        }
    }

    /**
     * Get bucket metrics
     */
    getBucketMetrics(bucketName) {
        const bucket = this.buckets.get(bucketName);
        if (!bucket) {
            throw new Error(`Bucket ${bucketName} not found`);
        }

        return {
            success: true,
            metrics: {
                ...bucket.metrics,
                requestMetrics: {
                    totalRequests: this.metrics.totalRequests,
                    avgResponseTime: Math.random() * 100 // Simulated
                }
            }
        };
    }

    /**
     * List all buckets
     */
    listBuckets() {
        const buckets = Array.from(this.buckets.values()).map(bucket => ({
            name: bucket.name,
            region: bucket.region,
            createdAt: bucket.createdAt,
            metrics: bucket.metrics
        }));

        return {
            success: true,
            buckets,
            total: buckets.length
        };
    }

    /**
     * Delete a bucket
     */
    async deleteBucket(bucketName, force = false) {
        const bucket = this.buckets.get(bucketName);
        if (!bucket) {
            throw new Error(`Bucket ${bucketName} not found`);
        }

        // Check if bucket is empty
        const objects = Array.from(this.objects.values())
            .filter(obj => obj.bucketName === bucketName);
        
        if (objects.length > 0 && !force) {
            throw new Error('Bucket is not empty. Use force=true to delete anyway.');
        }

        // Delete all objects in bucket
        for (const object of objects) {
            this.objects.delete(object.id);
        }

        // Delete bucket
        this.buckets.delete(bucketName);
        this.updateMetrics();
        
        return {
            success: true,
            bucketName,
            message: 'Bucket deleted successfully'
        };
    }

    // Helper methods
    generateBucketName() {
        return `moonvault-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateObjectId() {
        return `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateETag(data) {
        return `"${Math.random().toString(36).substr(2, 16)}"`;
    }

    generateVersion() {
        return Math.random().toString(36).substr(2, 16);
    }

    generateLifecycleId() {
        return `lifecycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateRuleId() {
        return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    calculateChecksum(data) {
        // Simulate checksum calculation
        return Math.random().toString(36).substr(2, 32);
    }

    findObjectByKey(bucketName, objectKey, version = null) {
        return Array.from(this.objects.values()).find(obj => 
            obj.bucketName === bucketName && 
            obj.key === objectKey && 
            (version === null || obj.version === version)
        );
    }

    hasAccess(object, permission) {
        // Simulate access control check
        return true; // Simplified for demo
    }

    matchesFilter(object, filter) {
        // Simulate filter matching
        return true; // Simplified for demo
    }

    async processLifecycleRule(object, rule) {
        // Simulate lifecycle rule processing
        // This would handle transitions between storage classes and expiration
    }

    updateMetrics() {
        this.metrics.totalBuckets = this.buckets.size;
        this.metrics.totalObjects = this.objects.size;
        this.metrics.totalSize = Array.from(this.objects.values())
            .reduce((total, obj) => total + obj.size, 0);
    }
}

module.exports = MoonVault;
