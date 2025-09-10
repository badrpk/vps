/**
 * GuardianGate - Advanced Firewall & Intrusion Detection System
 * Comprehensive network security with real-time threat detection and automated response
 */

class GuardianGate {
    constructor(config = {}) {
        this.config = {
            region: config.region || 'us-east-1',
            defaultAction: config.defaultAction || 'allow',
            enableLogging: config.enableLogging || true,
            enableThreatIntelligence: config.enableThreatIntelligence || true,
            enableAutoResponse: config.enableAutoResponse || true,
            maxRules: config.maxRules || 1000,
            ...config
        };
        
        this.securityGroups = new Map();
        this.firewallRules = new Map();
        this.threatIntelligence = new Map();
        this.incidents = new Map();
        this.logs = new Map();
        this.blockedIPs = new Set();
        this.suspiciousActivities = new Map();
        
        this.metrics = {
            totalSecurityGroups: 0,
            totalRules: 0,
            totalIncidents: 0,
            blockedRequests: 0,
            allowedRequests: 0,
            threatDetections: 0,
            falsePositives: 0
        };
        
        this.initializeThreatIntelligence();
    }

    /**
     * Initialize threat intelligence feeds
     */
    initializeThreatIntelligence() {
        const threatFeeds = [
            {
                id: 'malicious-ips',
                name: 'Malicious IP Addresses',
                type: 'ip',
                source: 'GuardianGate Threat Feed',
                lastUpdated: new Date(),
                entries: new Set()
            },
            {
                id: 'malicious-domains',
                name: 'Malicious Domains',
                type: 'domain',
                source: 'GuardianGate Threat Feed',
                lastUpdated: new Date(),
                entries: new Set()
            },
            {
                id: 'malware-signatures',
                name: 'Malware Signatures',
                type: 'signature',
                source: 'GuardianGate Threat Feed',
                lastUpdated: new Date(),
                entries: new Set()
            },
            {
                id: 'attack-patterns',
                name: 'Attack Patterns',
                type: 'pattern',
                source: 'GuardianGate Threat Feed',
                lastUpdated: new Date(),
                entries: new Set()
            }
        ];

        threatFeeds.forEach(feed => {
            this.threatIntelligence.set(feed.id, feed);
        });
    }

    /**
     * Create a security group
     */
    async createSecurityGroup(groupConfig) {
        const groupId = this.generateGroupId();
        const group = {
            id: groupId,
            name: groupConfig.name || `security-group-${groupId}`,
            description: groupConfig.description || 'Security group created by GuardianGate',
            vpcId: groupConfig.vpcId || 'default',
            region: groupConfig.region || this.config.region,
            tags: groupConfig.tags || {},
            createdAt: new Date(),
            status: 'active',
            rules: {
                inbound: [],
                outbound: []
            },
            metrics: {
                packetsProcessed: 0,
                packetsBlocked: 0,
                packetsAllowed: 0,
                threatsDetected: 0
            }
        };

        this.securityGroups.set(groupId, group);
        this.updateMetrics();
        
        return {
            success: true,
            groupId,
            group,
            message: 'Security group created successfully'
        };
    }

    /**
     * Add firewall rule to security group
     */
    async addFirewallRule(groupId, ruleConfig) {
        const group = this.securityGroups.get(groupId);
        if (!group) {
            throw new Error(`Security group ${groupId} not found`);
        }

        const ruleId = this.generateRuleId();
        const rule = {
            id: ruleId,
            groupId,
            direction: ruleConfig.direction || 'inbound',
            protocol: ruleConfig.protocol || 'tcp',
            portRange: ruleConfig.portRange || { from: 0, to: 65535 },
            source: ruleConfig.source || '0.0.0.0/0',
            destination: ruleConfig.destination || '0.0.0.0/0',
            action: ruleConfig.action || 'allow',
            priority: ruleConfig.priority || 100,
            description: ruleConfig.description || '',
            createdAt: new Date(),
            status: 'active',
            metrics: {
                packetsMatched: 0,
                packetsBlocked: 0,
                packetsAllowed: 0
            }
        };

        // Add rule to appropriate direction
        if (rule.direction === 'inbound') {
            group.rules.inbound.push(rule);
        } else {
            group.rules.outbound.push(rule);
        }

        this.firewallRules.set(ruleId, rule);
        this.updateMetrics();
        
        return {
            success: true,
            ruleId,
            rule,
            message: 'Firewall rule added successfully'
        };
    }

    /**
     * Process network packet through firewall
     */
    async processPacket(packet) {
        const startTime = Date.now();
        
        // Extract packet information
        const packetInfo = {
            sourceIP: packet.sourceIP,
            destinationIP: packet.destinationIP,
            sourcePort: packet.sourcePort,
            destinationPort: packet.destinationPort,
            protocol: packet.protocol,
            direction: packet.direction,
            timestamp: new Date(),
            size: packet.size || 0,
            payload: packet.payload || ''
        };

        // Check against blocked IPs first
        if (this.blockedIPs.has(packetInfo.sourceIP)) {
            this.logSecurityEvent('blocked', packetInfo, 'IP blocked by threat intelligence');
            this.metrics.blockedRequests++;
            return {
                success: true,
                action: 'block',
                reason: 'IP blocked by threat intelligence',
                processingTime: Date.now() - startTime
            };
        }

        // Find applicable security groups
        const applicableGroups = this.findApplicableSecurityGroups(packetInfo);
        
        if (applicableGroups.length === 0) {
            // No security groups found, use default action
            const action = this.config.defaultAction;
            this.logSecurityEvent(action, packetInfo, 'No security groups found');
            this.updatePacketMetrics(action);
            
            return {
                success: true,
                action,
                reason: 'No security groups found',
                processingTime: Date.now() - startTime
            };
        }

        // Process through security group rules
        for (const group of applicableGroups) {
            const result = await this.processPacketThroughGroup(group, packetInfo);
            
            if (result.action === 'block') {
                this.logSecurityEvent('blocked', packetInfo, result.reason);
                this.updatePacketMetrics('blocked');
                return {
                    success: true,
                    action: 'block',
                    reason: result.reason,
                    securityGroup: group.id,
                    processingTime: Date.now() - startTime
                };
            }
        }

        // If no rules blocked the packet, allow it
        this.logSecurityEvent('allowed', packetInfo, 'Packet allowed by security groups');
        this.updatePacketMetrics('allowed');
        
        return {
            success: true,
            action: 'allow',
            reason: 'Packet allowed by security groups',
            processingTime: Date.now() - startTime
        };
    }

    /**
     * Process packet through security group rules
     */
    async processPacketThroughGroup(group, packetInfo) {
        const rules = packetInfo.direction === 'inbound' ? 
            group.rules.inbound : group.rules.outbound;
        
        // Sort rules by priority (lower number = higher priority)
        const sortedRules = rules.sort((a, b) => a.priority - b.priority);
        
        for (const rule of sortedRules) {
            if (this.packetMatchesRule(packetInfo, rule)) {
                // Update rule metrics
                rule.metrics.packetsMatched++;
                
                if (rule.action === 'allow') {
                    rule.metrics.packetsAllowed++;
                } else {
                    rule.metrics.packetsBlocked++;
                }
                
                // Update group metrics
                group.metrics.packetsProcessed++;
                if (rule.action === 'allow') {
                    group.metrics.packetsAllowed++;
                } else {
                    group.metrics.packetsBlocked++;
                }
                
                return {
                    action: rule.action,
                    reason: `Matched rule: ${rule.description || rule.id}`,
                    rule: rule.id
                };
            }
        }
        
        return { action: 'allow', reason: 'No matching rules found' };
    }

    /**
     * Check if packet matches a rule
     */
    packetMatchesRule(packetInfo, rule) {
        // Check protocol
        if (rule.protocol !== 'any' && rule.protocol !== packetInfo.protocol) {
            return false;
        }
        
        // Check port range
        if (rule.portRange.from !== 0 || rule.portRange.to !== 65535) {
            const port = packetInfo.direction === 'inbound' ? 
                packetInfo.destinationPort : packetInfo.sourcePort;
            
            if (port < rule.portRange.from || port > rule.portRange.to) {
                return false;
            }
        }
        
        // Check source/destination
        if (rule.direction === 'inbound') {
            if (!this.ipMatchesCIDR(packetInfo.sourceIP, rule.source)) {
                return false;
            }
        } else {
            if (!this.ipMatchesCIDR(packetInfo.destinationIP, rule.destination)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Detect and respond to threats
     */
    async detectThreats(packetInfo) {
        const threats = [];
        
        // Check against threat intelligence
        for (const [feedId, feed] of this.threatIntelligence) {
            if (feed.type === 'ip' && feed.entries.has(packetInfo.sourceIP)) {
                threats.push({
                    type: 'malicious_ip',
                    severity: 'high',
                    source: feedId,
                    description: `Source IP ${packetInfo.sourceIP} found in ${feed.name}`
                });
            }
        }
        
        // Check for suspicious patterns
        const suspiciousPattern = this.detectSuspiciousPattern(packetInfo);
        if (suspiciousPattern) {
            threats.push(suspiciousPattern);
        }
        
        // Check for DDoS patterns
        const ddosPattern = this.detectDDoSPattern(packetInfo);
        if (ddosPattern) {
            threats.push(ddosPattern);
        }
        
        // Process threats
        for (const threat of threats) {
            await this.processThreat(threat, packetInfo);
        }
        
        return threats;
    }

    /**
     * Process detected threat
     */
    async processThreat(threat, packetInfo) {
        const incidentId = this.generateIncidentId();
        const incident = {
            id: incidentId,
            threat,
            packetInfo,
            timestamp: new Date(),
            status: 'active',
            severity: threat.severity,
            autoResponse: this.config.enableAutoResponse,
            actions: []
        };
        
        this.incidents.set(incidentId, incident);
        this.metrics.threatDetections++;
        
        // Auto-response based on threat severity
        if (this.config.enableAutoResponse) {
            if (threat.severity === 'critical' || threat.severity === 'high') {
                // Block the IP
                this.blockedIPs.add(packetInfo.sourceIP);
                incident.actions.push({
                    action: 'block_ip',
                    target: packetInfo.sourceIP,
                    timestamp: new Date()
                });
            }
            
            if (threat.type === 'ddos') {
                // Implement rate limiting
                incident.actions.push({
                    action: 'rate_limit',
                    target: packetInfo.sourceIP,
                    timestamp: new Date()
                });
            }
        }
        
        return incident;
    }

    /**
     * Detect suspicious patterns
     */
    detectSuspiciousPattern(packetInfo) {
        const sourceIP = packetInfo.sourceIP;
        const now = Date.now();
        
        // Track requests per IP
        if (!this.suspiciousActivities.has(sourceIP)) {
            this.suspiciousActivities.set(sourceIP, {
                requestCount: 0,
                firstSeen: now,
                lastSeen: now,
                patterns: []
            });
        }
        
        const activity = this.suspiciousActivities.get(sourceIP);
        activity.requestCount++;
        activity.lastSeen = now;
        
        // Check for port scanning
        if (this.isPortScanning(activity)) {
            return {
                type: 'port_scanning',
                severity: 'medium',
                description: `Port scanning detected from ${sourceIP}`
            };
        }
        
        // Check for rapid requests
        if (activity.requestCount > 100 && (now - activity.firstSeen) < 60000) {
            return {
                type: 'rapid_requests',
                severity: 'high',
                description: `Rapid requests detected from ${sourceIP}`
            };
        }
        
        return null;
    }

    /**
     * Detect DDoS patterns
     */
    detectDDoSPattern(packetInfo) {
        // Simple DDoS detection based on request volume
        const sourceIP = packetInfo.sourceIP;
        const now = Date.now();
        
        if (!this.suspiciousActivities.has(sourceIP)) {
            return null;
        }
        
        const activity = this.suspiciousActivities.get(sourceIP);
        
        // Check for DDoS pattern (high volume, short time)
        if (activity.requestCount > 1000 && (now - activity.firstSeen) < 300000) {
            return {
                type: 'ddos',
                severity: 'critical',
                description: `DDoS attack detected from ${sourceIP}`
            };
        }
        
        return null;
    }

    /**
     * Check if IP is port scanning
     */
    isPortScanning(activity) {
        // Simple port scanning detection
        return activity.requestCount > 50 && 
               activity.patterns.length > 10 &&
               (activity.lastSeen - activity.firstSeen) < 300000;
    }

    /**
     * Get security group details
     */
    getSecurityGroup(groupId) {
        const group = this.securityGroups.get(groupId);
        if (!group) {
            throw new Error(`Security group ${groupId} not found`);
        }

        return {
            success: true,
            group: {
                ...group,
                metrics: this.getSecurityGroupMetrics(groupId)
            }
        };
    }

    /**
     * List all security groups
     */
    listSecurityGroups() {
        const groups = Array.from(this.securityGroups.values()).map(group => ({
            ...group,
            metrics: this.getSecurityGroupMetrics(group.id)
        }));

        return {
            success: true,
            groups,
            total: groups.length
        };
    }

    /**
     * Get security incidents
     */
    getIncidents(filters = {}) {
        let incidents = Array.from(this.incidents.values());
        
        // Apply filters
        if (filters.severity) {
            incidents = incidents.filter(incident => incident.severity === filters.severity);
        }
        
        if (filters.status) {
            incidents = incidents.filter(incident => incident.status === filters.status);
        }
        
        if (filters.startTime) {
            incidents = incidents.filter(incident => incident.timestamp >= filters.startTime);
        }
        
        if (filters.endTime) {
            incidents = incidents.filter(incident => incident.timestamp <= filters.endTime);
        }

        // Sort by timestamp (newest first)
        incidents.sort((a, b) => b.timestamp - a.timestamp);
        
        return {
            success: true,
            incidents,
            total: incidents.length
        };
    }

    /**
     * Get security logs
     */
    getSecurityLogs(filters = {}) {
        let logs = Array.from(this.logs.values());
        
        // Apply filters
        if (filters.action) {
            logs = logs.filter(log => log.action === filters.action);
        }
        
        if (filters.sourceIP) {
            logs = logs.filter(log => log.packetInfo.sourceIP === filters.sourceIP);
        }
        
        if (filters.startTime) {
            logs = logs.filter(log => log.timestamp >= filters.startTime);
        }
        
        if (filters.endTime) {
            logs = logs.filter(log => log.timestamp <= filters.endTime);
        }

        // Sort by timestamp (newest first)
        logs.sort((a, b) => b.timestamp - a.timestamp);
        
        // Pagination
        const page = filters.page || 1;
        const limit = filters.limit || 100;
        const startIndex = (page - 1) * limit;
        
        return {
            success: true,
            logs: logs.slice(startIndex, startIndex + limit),
            total: logs.length,
            page,
            limit
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
                threatIntelligence: Array.from(this.threatIntelligence.values()).map(feed => ({
                    id: feed.id,
                    name: feed.name,
                    type: feed.type,
                    entryCount: feed.entries.size,
                    lastUpdated: feed.lastUpdated
                })),
                blockedIPs: this.blockedIPs.size,
                suspiciousActivities: this.suspiciousActivities.size
            }
        };
    }

    // Helper methods
    generateGroupId() {
        return `sg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateRuleId() {
        return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateIncidentId() {
        return `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    findApplicableSecurityGroups(packetInfo) {
        // Simplified logic - in real implementation, this would check VPC, subnet, etc.
        return Array.from(this.securityGroups.values()).filter(group => 
            group.status === 'active'
        );
    }

    ipMatchesCIDR(ip, cidr) {
        // Simplified CIDR matching - in real implementation, use proper CIDR library
        if (cidr === '0.0.0.0/0') return true;
        if (cidr === ip) return true;
        
        // Simple prefix matching for demo
        const prefix = cidr.split('/')[0];
        return ip.startsWith(prefix.split('.').slice(0, -1).join('.'));
    }

    logSecurityEvent(action, packetInfo, reason) {
        const logId = this.generateLogId();
        const log = {
            id: logId,
            action,
            packetInfo,
            reason,
            timestamp: new Date()
        };
        
        this.logs.set(logId, log);
        
        // Keep only last 10000 logs
        if (this.logs.size > 10000) {
            const firstKey = this.logs.keys().next().value;
            this.logs.delete(firstKey);
        }
    }

    generateLogId() {
        return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    updatePacketMetrics(action) {
        if (action === 'blocked') {
            this.metrics.blockedRequests++;
        } else {
            this.metrics.allowedRequests++;
        }
    }

    getSecurityGroupMetrics(groupId) {
        const group = this.securityGroups.get(groupId);
        if (!group) return null;
        
        return {
            ...group.metrics,
            totalRules: group.rules.inbound.length + group.rules.outbound.length,
            inboundRules: group.rules.inbound.length,
            outboundRules: group.rules.outbound.length
        };
    }

    updateMetrics() {
        this.metrics.totalSecurityGroups = this.securityGroups.size;
        this.metrics.totalRules = this.firewallRules.size;
        this.metrics.totalIncidents = this.incidents.size;
    }
}

module.exports = GuardianGate;
