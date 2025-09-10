/**
 * EdgeForge - Edge Computing Platform
 * Distributed edge computing with device management and real-time processing
 */

class EdgeForge {
    constructor(config = {}) {
        this.config = {
            region: config.region || 'us-east-1',
            maxDevices: config.maxDevices || 10000,
            enableRealTimeProcessing: config.enableRealTimeProcessing || true,
            enableDeviceManagement: config.enableDeviceManagement || true,
            enableEdgeAnalytics: config.enableEdgeAnalytics || true,
            ...config
        };
        
        this.devices = new Map();
        this.deviceGroups = new Map();
        this.edgeNodes = new Map();
        this.workloads = new Map();
        this.dataStreams = new Map();
        this.analytics = new Map();
        this.deviceCertificates = new Map();
        
        this.metrics = {
            totalDevices: 0,
            activeDevices: 0,
            totalEdgeNodes: 0,
            activeEdgeNodes: 0,
            totalWorkloads: 0,
            runningWorkloads: 0,
            totalDataStreams: 0,
            messagesProcessed: 0,
            averageLatency: 0
        };
        
        this.startDeviceMonitoring();
    }

    /**
     * Register a new device
     */
    async registerDevice(deviceConfig) {
        const deviceId = this.generateDeviceId();
        const device = {
            id: deviceId,
            name: deviceConfig.name || `device-${deviceId}`,
            type: deviceConfig.type || 'sensor',
            model: deviceConfig.model || 'generic',
            firmware: deviceConfig.firmware || '1.0.0',
            location: deviceConfig.location || { lat: 0, lng: 0 },
            edgeNodeId: deviceConfig.edgeNodeId,
            groupId: deviceConfig.groupId,
            capabilities: deviceConfig.capabilities || [],
            status: 'offline',
            lastSeen: null,
            createdAt: new Date(),
            tags: deviceConfig.tags || {},
            metrics: {
                messagesSent: 0,
                messagesReceived: 0,
                uptime: 0,
                lastHeartbeat: null
            }
        };

        this.devices.set(deviceId, device);
        this.updateMetrics();
        
        // Generate device certificate
        const certificate = await this.generateDeviceCertificate(deviceId);
        this.deviceCertificates.set(deviceId, certificate);
        
        return {
            success: true,
            deviceId,
            device,
            certificate,
            message: 'Device registered successfully'
        };
    }

    /**
     * Create edge node
     */
    async createEdgeNode(nodeConfig) {
        const nodeId = this.generateNodeId();
        const node = {
            id: nodeId,
            name: nodeConfig.name || `edge-node-${nodeId}`,
            location: nodeConfig.location || { lat: 0, lng: 0 },
            region: nodeConfig.region || this.config.region,
            computeResources: nodeConfig.computeResources || {
                cpu: '2 vCPU',
                memory: '4 GB',
                storage: '50 GB'
            },
            networkConfig: nodeConfig.networkConfig || {
                bandwidth: '100 Mbps',
                latency: '10ms'
            },
            status: 'active',
            devices: [],
            workloads: [],
            createdAt: new Date(),
            tags: nodeConfig.tags || {},
            metrics: {
                cpuUtilization: 0,
                memoryUtilization: 0,
                networkUtilization: 0,
                activeConnections: 0
            }
        };

        this.edgeNodes.set(nodeId, node);
        this.updateMetrics();
        
        return {
            success: true,
            nodeId,
            node,
            message: 'Edge node created successfully'
        };
    }

    /**
     * Deploy workload to edge node
     */
    async deployWorkload(workloadConfig) {
        const workloadId = this.generateWorkloadId();
        const workload = {
            id: workloadId,
            name: workloadConfig.name || `workload-${workloadId}`,
            type: workloadConfig.type || 'container',
            image: workloadConfig.image,
            nodeId: workloadConfig.nodeId,
            resources: workloadConfig.resources || {
                cpu: '0.5 vCPU',
                memory: '1 GB'
            },
            environment: workloadConfig.environment || {},
            ports: workloadConfig.ports || [],
            status: 'pending',
            createdAt: new Date(),
            startedAt: null,
            metrics: {
                cpuUsage: 0,
                memoryUsage: 0,
                networkIO: 0,
                uptime: 0
            }
        };

        this.workloads.set(workloadId, workload);
        
        // Deploy to edge node
        const node = this.edgeNodes.get(workload.nodeId);
        if (node) {
            node.workloads.push(workloadId);
            await this.startWorkload(workload);
        }
        
        this.updateMetrics();
        
        return {
            success: true,
            workloadId,
            workload,
            message: 'Workload deployed successfully'
        };
    }

    /**
     * Send device data
     */
    async sendDeviceData(deviceId, data) {
        const device = this.devices.get(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        const messageId = this.generateMessageId();
        const message = {
            id: messageId,
            deviceId,
            data,
            timestamp: new Date(),
            processed: false
        };

        // Update device status
        device.status = 'online';
        device.lastSeen = new Date();
        device.metrics.messagesSent++;
        device.metrics.lastHeartbeat = new Date();

        // Process data through edge analytics
        await this.processDeviceData(message);
        
        this.metrics.messagesProcessed++;
        
        return {
            success: true,
            messageId,
            message,
            message: 'Device data processed successfully'
        };
    }

    /**
     * Create data stream
     */
    async createDataStream(streamConfig) {
        const streamId = this.generateStreamId();
        const stream = {
            id: streamId,
            name: streamConfig.name || `stream-${streamId}`,
            source: streamConfig.source || 'devices',
            destination: streamConfig.destination || 'cloud',
            filters: streamConfig.filters || [],
            transformations: streamConfig.transformations || [],
            status: 'active',
            createdAt: new Date(),
            metrics: {
                messagesProcessed: 0,
                messagesFiltered: 0,
                averageProcessingTime: 0
            }
        };

        this.dataStreams.set(streamId, stream);
        this.updateMetrics();
        
        return {
            success: true,
            streamId,
            stream,
            message: 'Data stream created successfully'
        };
    }

    /**
     * Get device status
     */
    getDeviceStatus(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        return {
            success: true,
            device: {
                ...device,
                isOnline: device.status === 'online',
                uptime: this.calculateDeviceUptime(device),
                health: this.calculateDeviceHealth(device)
            }
        };
    }

    /**
     * List devices
     */
    listDevices(filters = {}) {
        let devices = Array.from(this.devices.values());
        
        // Apply filters
        if (filters.status) {
            devices = devices.filter(device => device.status === filters.status);
        }
        
        if (filters.type) {
            devices = devices.filter(device => device.type === filters.type);
        }
        
        if (filters.groupId) {
            devices = devices.filter(device => device.groupId === filters.groupId);
        }

        return {
            success: true,
            devices: devices.map(device => ({
                id: device.id,
                name: device.name,
                type: device.type,
                status: device.status,
                lastSeen: device.lastSeen,
                location: device.location,
                metrics: device.metrics
            })),
            total: devices.length
        };
    }

    /**
     * Get edge node details
     */
    getEdgeNode(nodeId) {
        const node = this.edgeNodes.get(nodeId);
        if (!node) {
            throw new Error(`Edge node ${nodeId} not found`);
        }

        return {
            success: true,
            node: {
                ...node,
                deviceCount: node.devices.length,
                workloadCount: node.workloads.length,
                health: this.calculateNodeHealth(node)
            }
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
                deviceOnlineRate: this.metrics.totalDevices > 0 ? 
                    (this.metrics.activeDevices / this.metrics.totalDevices) * 100 : 0,
                edgeNodeUtilization: this.calculateAverageNodeUtilization(),
                workloadSuccessRate: this.calculateWorkloadSuccessRate()
            }
        };
    }

    // Helper methods
    generateDeviceId() {
        return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateNodeId() {
        return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateWorkloadId() {
        return `workload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateStreamId() {
        return `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateMessageId() {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    async generateDeviceCertificate(deviceId) {
        // Simulate certificate generation
        await this.simulateOperation(1000);
        
        return {
            deviceId,
            certificateId: `cert-${deviceId}`,
            publicKey: `public-key-${deviceId}`,
            privateKey: `private-key-${deviceId}`,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            createdAt: new Date()
        };
    }

    async startWorkload(workload) {
        workload.status = 'running';
        workload.startedAt = new Date();
        
        // Simulate workload startup
        await this.simulateOperation(2000);
        
        // Start monitoring workload metrics
        this.startWorkloadMonitoring(workload.id);
    }

    async processDeviceData(message) {
        // Apply data stream filters and transformations
        for (const [streamId, stream] of this.dataStreams) {
            if (stream.status === 'active' && this.matchesStreamSource(stream, message)) {
                await this.processStreamMessage(stream, message);
            }
        }
        
        message.processed = true;
    }

    matchesStreamSource(stream, message) {
        if (stream.source === 'devices') {
            return true; // All device messages
        }
        
        if (stream.source === 'specific' && stream.filters.length > 0) {
            return stream.filters.some(filter => 
                filter.deviceId === message.deviceId
            );
        }
        
        return false;
    }

    async processStreamMessage(stream, message) {
        const startTime = Date.now();
        
        // Apply transformations
        let processedData = message.data;
        for (const transformation of stream.transformations) {
            processedData = await this.applyTransformation(transformation, processedData);
        }
        
        // Update stream metrics
        stream.metrics.messagesProcessed++;
        stream.metrics.averageProcessingTime = 
            (stream.metrics.averageProcessingTime * (stream.metrics.messagesProcessed - 1) + 
             (Date.now() - startTime)) / stream.metrics.messagesProcessed;
    }

    async applyTransformation(transformation, data) {
        // Simulate data transformation
        await this.simulateOperation(50);
        
        switch (transformation.type) {
            case 'filter':
                return transformation.condition ? data : null;
            case 'aggregate':
                return { ...data, aggregated: true };
            case 'enrich':
                return { ...data, enriched: true };
            default:
                return data;
        }
    }

    startDeviceMonitoring() {
        setInterval(() => {
            this.updateDeviceStatuses();
        }, 30000); // Every 30 seconds
    }

    startWorkloadMonitoring(workloadId) {
        setInterval(() => {
            this.updateWorkloadMetrics(workloadId);
        }, 10000); // Every 10 seconds
    }

    updateDeviceStatuses() {
        const now = Date.now();
        const timeout = 5 * 60 * 1000; // 5 minutes
        
        for (const [deviceId, device] of this.devices) {
            if (device.lastSeen && (now - device.lastSeen.getTime()) > timeout) {
                device.status = 'offline';
            }
        }
        
        this.updateMetrics();
    }

    updateWorkloadMetrics(workloadId) {
        const workload = this.workloads.get(workloadId);
        if (!workload || workload.status !== 'running') return;
        
        // Simulate metric updates
        workload.metrics.cpuUsage = Math.random() * 100;
        workload.metrics.memoryUsage = Math.random() * 100;
        workload.metrics.networkIO = Math.random() * 1000;
        workload.metrics.uptime = Date.now() - workload.startedAt.getTime();
    }

    calculateDeviceUptime(device) {
        if (!device.lastSeen) return 0;
        return Date.now() - device.createdAt.getTime();
    }

    calculateDeviceHealth(device) {
        const uptime = this.calculateDeviceUptime(device);
        const lastSeen = device.lastSeen;
        
        if (!lastSeen) return 'unknown';
        
        const timeSinceLastSeen = Date.now() - lastSeen.getTime();
        if (timeSinceLastSeen < 60000) return 'excellent'; // < 1 minute
        if (timeSinceLastSeen < 300000) return 'good'; // < 5 minutes
        if (timeSinceLastSeen < 900000) return 'fair'; // < 15 minutes
        return 'poor';
    }

    calculateNodeHealth(node) {
        const cpuUtil = node.metrics.cpuUtilization;
        const memUtil = node.metrics.memoryUtilization;
        
        if (cpuUtil < 50 && memUtil < 50) return 'excellent';
        if (cpuUtil < 80 && memUtil < 80) return 'good';
        if (cpuUtil < 95 && memUtil < 95) return 'fair';
        return 'poor';
    }

    calculateAverageNodeUtilization() {
        const nodes = Array.from(this.edgeNodes.values());
        if (nodes.length === 0) return 0;
        
        const totalUtil = nodes.reduce((sum, node) => 
            sum + node.metrics.cpuUtilization + node.metrics.memoryUtilization, 0);
        
        return totalUtil / (nodes.length * 2);
    }

    calculateWorkloadSuccessRate() {
        const workloads = Array.from(this.workloads.values());
        if (workloads.length === 0) return 100;
        
        const runningWorkloads = workloads.filter(w => w.status === 'running').length;
        return (runningWorkloads / workloads.length) * 100;
    }

    async simulateOperation(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    updateMetrics() {
        this.metrics.totalDevices = this.devices.size;
        this.metrics.activeDevices = Array.from(this.devices.values())
            .filter(device => device.status === 'online').length;
        this.metrics.totalEdgeNodes = this.edgeNodes.size;
        this.metrics.activeEdgeNodes = Array.from(this.edgeNodes.values())
            .filter(node => node.status === 'active').length;
        this.metrics.totalWorkloads = this.workloads.size;
        this.metrics.runningWorkloads = Array.from(this.workloads.values())
            .filter(workload => workload.status === 'running').length;
        this.metrics.totalDataStreams = this.dataStreams.size;
    }
}

module.exports = EdgeForge;
