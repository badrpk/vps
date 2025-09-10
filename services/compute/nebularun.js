/**
 * NebulaRun - Scalable Compute Instances
 * Auto-scaling compute instances optimized for cloud-native applications
 */

class NebulaRun {
    constructor(config = {}) {
        this.config = {
            region: config.region || 'us-east-1',
            autoScalingEnabled: config.autoScalingEnabled || true,
            minInstances: config.minInstances || 1,
            maxInstances: config.maxInstances || 10,
            targetCPUUtilization: config.targetCPUUtilization || 70,
            scaleOutCooldown: config.scaleOutCooldown || 300,
            scaleInCooldown: config.scaleInCooldown || 300,
            ...config
        };
        
        this.instances = new Map();
        this.autoScalingGroups = new Map();
        this.scalingPolicies = new Map();
        this.metrics = {
            totalInstances: 0,
            activeInstances: 0,
            pendingInstances: 0,
            scalingEvents: []
        };
    }

    /**
     * Create an Auto Scaling Group
     */
    async createAutoScalingGroup(groupConfig) {
        const groupId = this.generateGroupId();
        const group = {
            id: groupId,
            name: groupConfig.name || `nebula-group-${groupId}`,
            launchTemplate: groupConfig.launchTemplate,
            minSize: groupConfig.minSize || this.config.minInstances,
            maxSize: groupConfig.maxSize || this.config.maxInstances,
            desiredCapacity: groupConfig.desiredCapacity || groupConfig.minSize || 1,
            targetCPUUtilization: groupConfig.targetCPUUtilization || this.config.targetCPUUtilization,
            instances: [],
            status: 'active',
            createdAt: new Date(),
            region: groupConfig.region || this.config.region,
            healthCheckType: groupConfig.healthCheckType || 'EC2',
            healthCheckGracePeriod: groupConfig.healthCheckGracePeriod || 300,
            scalingPolicies: [],
            cooldown: groupConfig.cooldown || 300
        };

        this.autoScalingGroups.set(groupId, group);
        
        // Create initial instances
        await this.createInitialInstances(group);
        
        return {
            success: true,
            groupId,
            group,
            message: 'Auto Scaling Group created successfully'
        };
    }

    /**
     * Create initial instances for the group
     */
    async createInitialInstances(group) {
        for (let i = 0; i < group.desiredCapacity; i++) {
            await this.createInstanceInGroup(group.id);
        }
    }

    /**
     * Create an instance within an Auto Scaling Group
     */
    async createInstanceInGroup(groupId) {
        const group = this.autoScalingGroups.get(groupId);
        if (!group) {
            throw new Error(`Auto Scaling Group ${groupId} not found`);
        }

        const instanceId = this.generateInstanceId();
        const instance = {
            id: instanceId,
            groupId,
            name: `nebula-instance-${instanceId}`,
            type: group.launchTemplate.instanceType || 'nebula.standard',
            cpu: group.launchTemplate.cpu || 2,
            memory: group.launchTemplate.memory || 4,
            storage: group.launchTemplate.storage || 50,
            status: 'pending',
            createdAt: new Date(),
            region: group.region,
            healthStatus: 'initializing',
            lifecycleState: 'pending',
            tags: group.launchTemplate.tags || {},
            securityGroups: group.launchTemplate.securityGroups || ['default']
        };

        // Simulate instance creation
        await this.simulateInstanceCreation(instance);
        
        this.instances.set(instanceId, instance);
        group.instances.push(instanceId);
        this.updateMetrics();
        
        return {
            success: true,
            instanceId,
            instance,
            message: 'Instance created in Auto Scaling Group'
        };
    }

    /**
     * Scale out (add instances)
     */
    async scaleOut(groupId, count = 1) {
        const group = this.autoScalingGroups.get(groupId);
        if (!group) {
            throw new Error(`Auto Scaling Group ${groupId} not found`);
        }

        const currentCount = group.instances.length;
        const newCount = Math.min(currentCount + count, group.maxSize);
        const instancesToAdd = newCount - currentCount;

        if (instancesToAdd <= 0) {
            return { success: true, message: 'Already at maximum capacity' };
        }

        // Check cooldown period
        if (this.isInCooldown(groupId, 'scaleOut')) {
            return { success: false, message: 'Scale out in cooldown period' };
        }

        // Create new instances
        for (let i = 0; i < instancesToAdd; i++) {
            await this.createInstanceInGroup(groupId);
        }

        // Record scaling event
        this.recordScalingEvent(groupId, 'scaleOut', instancesToAdd);
        this.setCooldown(groupId, 'scaleOut');

        return {
            success: true,
            groupId,
            instancesAdded: instancesToAdd,
            message: `Scaled out by ${instancesToAdd} instances`
        };
    }

    /**
     * Scale in (remove instances)
     */
    async scaleIn(groupId, count = 1) {
        const group = this.autoScalingGroups.get(groupId);
        if (!group) {
            throw new Error(`Auto Scaling Group ${groupId} not found`);
        }

        const currentCount = group.instances.length;
        const newCount = Math.max(currentCount - count, group.minSize);
        const instancesToRemove = currentCount - newCount;

        if (instancesToRemove <= 0) {
            return { success: true, message: 'Already at minimum capacity' };
        }

        // Check cooldown period
        if (this.isInCooldown(groupId, 'scaleIn')) {
            return { success: false, message: 'Scale in in cooldown period' };
        }

        // Remove instances (oldest first)
        const instancesToTerminate = group.instances.slice(0, instancesToRemove);
        for (const instanceId of instancesToTerminate) {
            await this.terminateInstance(instanceId);
        }

        // Record scaling event
        this.recordScalingEvent(groupId, 'scaleIn', instancesToRemove);
        this.setCooldown(groupId, 'scaleIn');

        return {
            success: true,
            groupId,
            instancesRemoved: instancesToRemove,
            message: `Scaled in by ${instancesToRemove} instances`
        };
    }

    /**
     * Auto-scale based on metrics
     */
    async autoScale(groupId) {
        const group = this.autoScalingGroups.get(groupId);
        if (!group) {
            throw new Error(`Auto Scaling Group ${groupId} not found`);
        }

        const avgCPUUtilization = await this.getAverageCPUUtilization(groupId);
        
        if (avgCPUUtilization > group.targetCPUUtilization) {
            // Scale out
            return await this.scaleOut(groupId);
        } else if (avgCPUUtilization < (group.targetCPUUtilization - 20)) {
            // Scale in
            return await this.scaleIn(groupId);
        }

        return {
            success: true,
            message: 'No scaling action needed',
            avgCPUUtilization
        };
    }

    /**
     * Get average CPU utilization for a group
     */
    async getAverageCPUUtilization(groupId) {
        const group = this.autoScalingGroups.get(groupId);
        if (!group || group.instances.length === 0) {
            return 0;
        }

        let totalUtilization = 0;
        let activeInstances = 0;

        for (const instanceId of group.instances) {
            const instance = this.instances.get(instanceId);
            if (instance && instance.status === 'running') {
                const metrics = this.getInstanceMetrics(instanceId);
                totalUtilization += metrics.cpuUtilization;
                activeInstances++;
            }
        }

        return activeInstances > 0 ? totalUtilization / activeInstances : 0;
    }

    /**
     * Terminate an instance
     */
    async terminateInstance(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            throw new Error(`Instance ${instanceId} not found`);
        }

        instance.status = 'terminating';
        instance.lifecycleState = 'terminating';
        
        await this.simulateOperation(2000);
        
        // Remove from group
        const group = this.autoScalingGroups.get(instance.groupId);
        if (group) {
            group.instances = group.instances.filter(id => id !== instanceId);
        }
        
        this.instances.delete(instanceId);
        this.updateMetrics();
        
        return {
            success: true,
            instanceId,
            message: 'Instance terminated successfully'
        };
    }

    /**
     * Get Auto Scaling Group details
     */
    getAutoScalingGroup(groupId) {
        const group = this.autoScalingGroups.get(groupId);
        if (!group) {
            throw new Error(`Auto Scaling Group ${groupId} not found`);
        }

        return {
            success: true,
            group: {
                ...group,
                instances: group.instances.map(id => this.instances.get(id)).filter(Boolean),
                metrics: this.getGroupMetrics(groupId)
            }
        };
    }

    /**
     * List all Auto Scaling Groups
     */
    listAutoScalingGroups() {
        const groups = Array.from(this.autoScalingGroups.values()).map(group => ({
            ...group,
            instances: group.instances.map(id => this.instances.get(id)).filter(Boolean),
            metrics: this.getGroupMetrics(group.id)
        }));

        return {
            success: true,
            groups,
            total: groups.length
        };
    }

    /**
     * Get group metrics
     */
    getGroupMetrics(groupId) {
        const group = this.autoScalingGroups.get(groupId);
        if (!group) {
            return null;
        }

        const runningInstances = group.instances.filter(id => {
            const instance = this.instances.get(id);
            return instance && instance.status === 'running';
        }).length;

        return {
            currentInstances: group.instances.length,
            runningInstances,
            pendingInstances: group.instances.length - runningInstances,
            avgCPUUtilization: this.getAverageCPUUtilization(groupId),
            scalingEvents: this.metrics.scalingEvents.filter(event => event.groupId === groupId)
        };
    }

    /**
     * Get instance metrics
     */
    getInstanceMetrics(instanceId) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            return null;
        }

        return {
            cpuUtilization: Math.random() * 100,
            memoryUtilization: Math.random() * 100,
            networkIn: Math.random() * 1000,
            networkOut: Math.random() * 1000,
            diskRead: Math.random() * 500,
            diskWrite: Math.random() * 500,
            uptime: instance.startedAt ? Date.now() - instance.startedAt.getTime() : 0,
            healthStatus: instance.healthStatus
        };
    }

    /**
     * Update desired capacity
     */
    async updateDesiredCapacity(groupId, desiredCapacity) {
        const group = this.autoScalingGroups.get(groupId);
        if (!group) {
            throw new Error(`Auto Scaling Group ${groupId} not found`);
        }

        if (desiredCapacity < group.minSize || desiredCapacity > group.maxSize) {
            throw new Error('Desired capacity must be between min and max size');
        }

        const currentCapacity = group.instances.length;
        group.desiredCapacity = desiredCapacity;

        if (desiredCapacity > currentCapacity) {
            // Scale out
            await this.scaleOut(groupId, desiredCapacity - currentCapacity);
        } else if (desiredCapacity < currentCapacity) {
            // Scale in
            await this.scaleIn(groupId, currentCapacity - desiredCapacity);
        }

        return {
            success: true,
            groupId,
            desiredCapacity,
            message: 'Desired capacity updated successfully'
        };
    }

    // Helper methods
    generateGroupId() {
        return `nebula-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateInstanceId() {
        return `nebula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    async simulateInstanceCreation(instance) {
        await this.simulateOperation(3000);
        instance.status = 'running';
        instance.lifecycleState = 'running';
        instance.healthStatus = 'healthy';
        instance.startedAt = new Date();
    }

    async simulateOperation(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    recordScalingEvent(groupId, action, count) {
        const event = {
            groupId,
            action,
            count,
            timestamp: new Date(),
            id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        
        this.metrics.scalingEvents.push(event);
        
        // Keep only last 100 events
        if (this.metrics.scalingEvents.length > 100) {
            this.metrics.scalingEvents = this.metrics.scalingEvents.slice(-100);
        }
    }

    setCooldown(groupId, action) {
        const cooldownKey = `${groupId}-${action}`;
        const cooldownDuration = action === 'scaleOut' ? 
            this.config.scaleOutCooldown : this.config.scaleInCooldown;
        
        this.cooldowns = this.cooldowns || new Map();
        this.cooldowns.set(cooldownKey, Date.now() + cooldownDuration * 1000);
    }

    isInCooldown(groupId, action) {
        const cooldownKey = `${groupId}-${action}`;
        const cooldownEnd = this.cooldowns?.get(cooldownKey);
        
        if (!cooldownEnd) return false;
        
        if (Date.now() < cooldownEnd) {
            return true;
        } else {
            this.cooldowns.delete(cooldownKey);
            return false;
        }
    }

    updateMetrics() {
        this.metrics.totalInstances = this.instances.size;
        this.metrics.activeInstances = Array.from(this.instances.values())
            .filter(instance => instance.status === 'running').length;
        this.metrics.pendingInstances = Array.from(this.instances.values())
            .filter(instance => instance.status === 'pending').length;
    }
}

module.exports = NebulaRun;
