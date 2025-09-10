/**
 * VPS-PK Cloud Platform - Load Testing Module
 * Comprehensive load testing and performance validation
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const cluster = require('cluster');
const os = require('os');

class VPSPKLoadTester {
    constructor(config = {}) {
        this.config = {
            baseUrl: config.baseUrl || 'http://localhost:3000',
            apiKey: config.apiKey || 'test-key-123',
            timeout: config.timeout || 30000,
            maxConcurrent: config.maxConcurrent || 100,
            rampUpTime: config.rampUpTime || 60, // seconds
            testDuration: config.testDuration || 300, // 5 minutes
            enableWorkers: config.enableWorkers !== false,
            ...config
        };

        this.results = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            throughput: 0,
            errorRate: 0,
            startTime: 0,
            endTime: 0,
            duration: 0,
            errors: []
        };

        this.testScenarios = {
            light: { users: 10, duration: 60 },
            medium: { users: 50, duration: 300 },
            heavy: { users: 100, duration: 600 },
            stress: { users: 200, duration: 900 },
            spike: { users: 500, duration: 300 }
        };

        console.log("VPS-PK Load Tester initialized");
    }

    /**
     * Run load test scenario
     */
    async runLoadTest(scenario = 'medium') {
        const testConfig = this.testScenarios[scenario];
        if (!testConfig) {
            throw new Error(`Invalid scenario: ${scenario}`);
        }

        console.log(`🚀 Starting ${scenario} load test...`);
        console.log(`👥 Users: ${testConfig.users}`);
        console.log(`⏱️ Duration: ${testConfig.duration}s`);
        console.log("=" * 50);

        this.results.startTime = Date.now();

        if (this.config.enableWorkers && cluster.isMaster) {
            await this.runWithWorkers(testConfig);
        } else {
            await this.runSingleProcess(testConfig);
        }

        this.results.endTime = Date.now();
        this.results.duration = this.results.endTime - this.results.startTime;

        this.calculateMetrics();
        this.generateReport();

        return this.results;
    }

    /**
     * Run load test with worker processes
     */
    async runWithWorkers(testConfig) {
        const numWorkers = Math.min(os.cpus().length, testConfig.users);
        const usersPerWorker = Math.ceil(testConfig.users / numWorkers);

        console.log(`🔧 Starting ${numWorkers} worker processes...`);

        const workers = [];
        const workerResults = [];

        // Fork workers
        for (let i = 0; i < numWorkers; i++) {
            const worker = cluster.fork();
            workers.push(worker);

            worker.on('message', (result) => {
                workerResults.push(result);
            });
        }

        // Send test configuration to workers
        workers.forEach(worker => {
            worker.send({
                type: 'start_test',
                config: {
                    ...this.config,
                    users: usersPerWorker,
                    duration: testConfig.duration
                }
            });
        });

        // Wait for test completion
        await new Promise(resolve => {
            const checkComplete = () => {
                if (workerResults.length === numWorkers) {
                    resolve();
                } else {
                    setTimeout(checkComplete, 1000);
                }
            };
            checkComplete();
        });

        // Aggregate results
        workerResults.forEach(result => {
            this.results.totalRequests += result.totalRequests;
            this.results.successfulRequests += result.successfulRequests;
            this.results.failedRequests += result.failedRequests;
            this.results.responseTimes.push(...result.responseTimes);
            this.results.errors.push(...result.errors);
        });

        // Kill workers
        workers.forEach(worker => worker.kill());
    }

    /**
     * Run load test in single process
     */
    async runSingleProcess(testConfig) {
        const requests = [];
        const startTime = Date.now();
        const endTime = startTime + (testConfig.duration * 1000);

        // Create user simulation tasks
        for (let user = 0; user < testConfig.users; user++) {
            requests.push(this.simulateUser(user, endTime));
        }

        // Wait for all users to complete
        const userResults = await Promise.allSettled(requests);

        // Aggregate results
        userResults.forEach(result => {
            if (result.status === 'fulfilled') {
                this.results.totalRequests += result.value.totalRequests;
                this.results.successfulRequests += result.value.successfulRequests;
                this.results.failedRequests += result.value.failedRequests;
                this.results.responseTimes.push(...result.value.responseTimes);
                this.results.errors.push(...result.value.errors);
            }
        });
    }

    /**
     * Simulate a single user
     */
    async simulateUser(userId, endTime) {
        const userResults = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            responseTimes: [],
            errors: []
        };

        const endpoints = [
            '/health',
            '/api/v1/compute/zephyrcore/instances',
            '/api/v1/storage/moonvault/buckets',
            '/api/v1/database/aurorabase/clusters',
            '/api/v1/analytics/datastream/streams',
            '/api/v1/analytics/insightforge/dashboards'
        ];

        while (Date.now() < endTime) {
            try {
                const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
                const method = Math.random() > 0.7 ? 'POST' : 'GET';
                
                const startTime = performance.now();
                const response = await this.makeRequest(method, endpoint);
                const endTime = performance.now();

                userResults.totalRequests++;
                userResults.successfulRequests++;
                userResults.responseTimes.push(endTime - startTime);

                // Random delay between requests (1-5 seconds)
                await this.delay(Math.random() * 4000 + 1000);

            } catch (error) {
                userResults.totalRequests++;
                userResults.failedRequests++;
                userResults.errors.push({
                    timestamp: new Date().toISOString(),
                    error: error.message,
                    userId: userId
                });

                // Shorter delay on error
                await this.delay(1000);
            }
        }

        return userResults;
    }

    /**
     * Run spike test
     */
    async runSpikeTest() {
        console.log("⚡ Starting spike test...");
        
        const phases = [
            { users: 10, duration: 30, name: 'Ramp Up' },
            { users: 200, duration: 60, name: 'Spike' },
            { users: 10, duration: 30, name: 'Ramp Down' }
        ];

        const results = [];

        for (const phase of phases) {
            console.log(`📈 Phase: ${phase.name} (${phase.users} users, ${phase.duration}s)`);
            
            const phaseResults = await this.runLoadTest({
                users: phase.users,
                duration: phase.duration
            });
            
            results.push({
                phase: phase.name,
                ...phaseResults
            });

            // Wait between phases
            await this.delay(10000);
        }

        return results;
    }

    /**
     * Run stress test
     */
    async runStressTest() {
        console.log("🔥 Starting stress test...");
        
        const maxUsers = 500;
        const increment = 50;
        const phaseDuration = 120; // 2 minutes per phase
        
        const results = [];

        for (let users = increment; users <= maxUsers; users += increment) {
            console.log(`📊 Testing with ${users} users...`);
            
            const phaseResults = await this.runLoadTest({
                users: users,
                duration: phaseDuration
            });
            
            results.push({
                users: users,
                ...phaseResults
            });

            // Check if system is still responsive
            if (phaseResults.errorRate > 50) {
                console.log(`⚠️ High error rate detected (${phaseResults.errorRate}%), stopping stress test`);
                break;
            }

            // Wait between phases
            await this.delay(30000);
        }

        return results;
    }

    /**
     * Run endurance test
     */
    async runEnduranceTest() {
        console.log("⏰ Starting endurance test...");
        
        const duration = 3600; // 1 hour
        const users = 50;
        
        console.log(`🕐 Running for ${duration}s with ${users} users`);
        
        return await this.runLoadTest({
            users: users,
            duration: duration
        });
    }

    /**
     * Test specific endpoints
     */
    async testEndpoints(endpoints) {
        console.log("🎯 Testing specific endpoints...");
        
        const results = [];

        for (const endpoint of endpoints) {
            console.log(`Testing: ${endpoint.method} ${endpoint.path}`);
            
            const endpointResults = await this.runLoadTest({
                users: endpoint.users || 20,
                duration: endpoint.duration || 60
            });
            
            results.push({
                endpoint: endpoint.path,
                method: endpoint.method,
                ...endpointResults
            });
        }

        return results;
    }

    /**
     * Make HTTP request
     */
    async makeRequest(method, path, data = null) {
        const config = {
            method: method.toLowerCase(),
            url: `${this.config.baseUrl}${path}`,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.config.apiKey
            }
        };

        if (data) {
            config.data = data;
        }

        return await axios(config);
    }

    /**
     * Calculate performance metrics
     */
    calculateMetrics() {
        const { responseTimes, totalRequests, successfulRequests, failedRequests, duration } = this.results;

        // Throughput (requests per second)
        this.results.throughput = (totalRequests / (duration / 1000)).toFixed(2);

        // Error rate
        this.results.errorRate = ((failedRequests / totalRequests) * 100).toFixed(2);

        // Response time statistics
        if (responseTimes.length > 0) {
            responseTimes.sort((a, b) => a - b);
            
            this.results.responseTimeStats = {
                min: Math.min(...responseTimes).toFixed(2),
                max: Math.max(...responseTimes).toFixed(2),
                avg: (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2),
                p50: this.percentile(responseTimes, 50).toFixed(2),
                p90: this.percentile(responseTimes, 90).toFixed(2),
                p95: this.percentile(responseTimes, 95).toFixed(2),
                p99: this.percentile(responseTimes, 99).toFixed(2)
            };
        }
    }

    /**
     * Calculate percentile
     */
    percentile(arr, p) {
        const index = Math.ceil((p / 100) * arr.length) - 1;
        return arr[index];
    }

    /**
     * Generate load test report
     */
    generateReport() {
        console.log("\n" + "=" * 60);
        console.log("📊 VPS-PK Cloud Platform Load Test Report");
        console.log("=" * 60);

        console.log(`\n📈 Test Summary:`);
        console.log(`  Duration: ${(this.results.duration / 1000).toFixed(2)}s`);
        console.log(`  Total Requests: ${this.results.totalRequests}`);
        console.log(`  Successful: ${this.results.successfulRequests} ✅`);
        console.log(`  Failed: ${this.results.failedRequests} ❌`);
        console.log(`  Throughput: ${this.results.throughput} req/s`);
        console.log(`  Error Rate: ${this.results.errorRate}%`);

        if (this.results.responseTimeStats) {
            console.log(`\n⏱️ Response Time Statistics:`);
            console.log(`  Average: ${this.results.responseTimeStats.avg}ms`);
            console.log(`  Min: ${this.results.responseTimeStats.min}ms`);
            console.log(`  Max: ${this.results.responseTimeStats.max}ms`);
            console.log(`  P50: ${this.results.responseTimeStats.p50}ms`);
            console.log(`  P90: ${this.results.responseTimeStats.p90}ms`);
            console.log(`  P95: ${this.results.responseTimeStats.p95}ms`);
            console.log(`  P99: ${this.results.responseTimeStats.p99}ms`);
        }

        if (this.results.errors.length > 0) {
            console.log(`\n❌ Error Summary:`);
            const errorCounts = {};
            this.results.errors.forEach(error => {
                errorCounts[error.error] = (errorCounts[error.error] || 0) + 1;
            });

            Object.entries(errorCounts).forEach(([error, count]) => {
                console.log(`  ${error}: ${count} occurrences`);
            });
        }

        // Performance assessment
        console.log(`\n🎯 Performance Assessment:`);
        const assessment = this.assessPerformance();
        console.log(`  Status: ${assessment.status}`);
        console.log(`  Grade: ${assessment.grade}`);
        console.log(`  Recommendations: ${assessment.recommendations.join(', ')}`);

        console.log("=" * 60);

        return this.results;
    }

    /**
     * Assess performance based on metrics
     */
    assessPerformance() {
        const { errorRate, throughput, responseTimeStats } = this.results;
        
        let status = 'EXCELLENT';
        let grade = 'A';
        let recommendations = [];

        // Check error rate
        if (errorRate > 10) {
            status = 'POOR';
            grade = 'F';
            recommendations.push('High error rate - investigate system stability');
        } else if (errorRate > 5) {
            status = 'FAIR';
            grade = 'C';
            recommendations.push('Moderate error rate - monitor closely');
        }

        // Check response times
        if (responseTimeStats) {
            const avgResponseTime = parseFloat(responseTimeStats.avg);
            const p95ResponseTime = parseFloat(responseTimeStats.p95);

            if (avgResponseTime > 2000) {
                status = 'POOR';
                grade = 'F';
                recommendations.push('Slow average response time - optimize performance');
            } else if (avgResponseTime > 1000) {
                if (status === 'EXCELLENT') {
                    status = 'GOOD';
                    grade = 'B';
                }
                recommendations.push('Moderate response time - consider optimization');
            }

            if (p95ResponseTime > 5000) {
                status = 'POOR';
                grade = 'F';
                recommendations.push('High P95 response time - investigate bottlenecks');
            }
        }

        // Check throughput
        const throughputNum = parseFloat(throughput);
        if (throughputNum < 10) {
            status = 'POOR';
            grade = 'F';
            recommendations.push('Low throughput - scale horizontally');
        } else if (throughputNum < 50) {
            if (status === 'EXCELLENT') {
                status = 'GOOD';
                grade = 'B';
            }
            recommendations.push('Moderate throughput - consider optimization');
        }

        return { status, grade, recommendations };
    }

    /**
     * Delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get test scenarios
     */
    getTestScenarios() {
        return this.testScenarios;
    }

    /**
     * Set custom test scenario
     */
    setTestScenario(name, config) {
        this.testScenarios[name] = config;
    }
}

// Worker process handling
if (cluster.isWorker) {
    process.on('message', async (message) => {
        if (message.type === 'start_test') {
            const tester = new VPSPKLoadTester(message.config);
            const results = await tester.runLoadTest({
                users: message.config.users,
                duration: message.config.duration
            });
            process.send(results);
        }
    });
}

module.exports = VPSPKLoadTester;
