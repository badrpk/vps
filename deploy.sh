#!/bin/bash

# VPS-PK Cloud Platform Deployment Script
# Automated deployment script for the complete cloud services platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="vps-pk-cloud-platform"
NODE_VERSION="16"
PORT=${PORT:-3000}
HOST=${HOST:-"0.0.0.0"}
NODE_ENV=${NODE_ENV:-"production"}

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "=================================================="
    echo "  VPS-PK Cloud Platform Deployment Script"
    echo "=================================================="
    echo -e "${NC}"
}

print_step() {
    echo -e "${YELLOW}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    print_step "Checking system requirements..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js $NODE_VERSION or higher."
        exit 1
    fi
    
    NODE_CURRENT=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_CURRENT" -lt "$NODE_VERSION" ]; then
        print_error "Node.js version $NODE_VERSION or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    print_success "System requirements check passed"
}

install_dependencies() {
    print_step "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        npm ci --only=production
    else
        npm install --only=production
    fi
    
    print_success "Dependencies installed successfully"
}

setup_environment() {
    print_step "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        cat > .env << EOF
NODE_ENV=$NODE_ENV
PORT=$PORT
HOST=$HOST
REGION=us-east-1
ENABLE_CORS=true
ENABLE_HELMET=true
ENABLE_RATE_LIMIT=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
MAX_MEMORY=2048
EOF
        print_success "Environment file created"
    else
        print_success "Environment file already exists"
    fi
}

create_directories() {
    print_step "Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p data
    mkdir -p backups
    mkdir -p temp
    
    print_success "Directories created"
}

run_tests() {
    print_step "Running tests..."
    
    if npm test; then
        print_success "All tests passed"
    else
        print_error "Tests failed. Please fix the issues before deployment."
        exit 1
    fi
}

lint_code() {
    print_step "Running code linting..."
    
    if npm run lint; then
        print_success "Code linting passed"
    else
        print_error "Code linting failed. Please fix the issues before deployment."
        exit 1
    fi
}

build_project() {
    print_step "Building project..."
    
    if npm run build; then
        print_success "Project built successfully"
    else
        print_error "Build failed. Please fix the issues before deployment."
        exit 1
    fi
}

start_services() {
    print_step "Starting VPS-PK Cloud Platform services..."
    
    # Start the main server
    if [ "$NODE_ENV" = "production" ]; then
        npm start &
        SERVER_PID=$!
    else
        npm run dev &
        SERVER_PID=$!
    fi
    
    # Wait for server to start
    sleep 5
    
    # Check if server is running
    if ps -p $SERVER_PID > /dev/null; then
        print_success "VPS-PK Cloud Platform started successfully (PID: $SERVER_PID)"
        echo $SERVER_PID > server.pid
    else
        print_error "Failed to start the server"
        exit 1
    fi
}

health_check() {
    print_step "Performing health check..."
    
    # Wait for server to be ready
    sleep 10
    
    # Check health endpoint
    if curl -f http://$HOST:$PORT/health > /dev/null 2>&1; then
        print_success "Health check passed"
    else
        print_error "Health check failed. Server may not be running properly."
        exit 1
    fi
}

show_status() {
    print_step "Deployment Status"
    
    echo -e "${GREEN}"
    echo "=================================================="
    echo "  VPS-PK Cloud Platform Deployment Complete!"
    echo "=================================================="
    echo -e "${NC}"
    
    echo "🌐 Server URL: http://$HOST:$PORT"
    echo "📊 Health Check: http://$HOST:$PORT/health"
    echo "📚 API Documentation: http://$HOST:$PORT/docs"
    echo "🔧 Service Status: http://$HOST:$PORT/status"
    echo ""
    echo "📋 Available Services:"
    echo "  • Compute Services (15): ZephyrCore, NebulaRun, StarWeave, etc."
    echo "  • Storage Services (12): MoonVault, DawnBlock, RiverShare, etc."
    echo "  • Database Services (15): AuroraBase, CosmoStore, NexusGraph, etc."
    echo "  • Networking Services (12): SkyNet, PulseBalance, BeaconDNS, etc."
    echo "  • AI/ML Services (15): IntelliSynth, VisionSpark, LinguaNet, etc."
    echo "  • Security Services (12): GuardianGate, VaultKey, SentinelWatch, etc."
    echo "  • And 150+ more services across 20+ categories"
    echo ""
    echo "🔑 API Authentication:"
    echo "  Include 'X-API-Key: your-api-key' header in requests"
    echo ""
    echo "📖 Quick Start:"
    echo "  curl -H 'X-API-Key: your-api-key' http://$HOST:$PORT/api/v1/compute/zephyrcore/instances"
    echo ""
    echo "🛑 To stop the server: kill \$(cat server.pid)"
    echo ""
}

cleanup() {
    print_step "Cleaning up temporary files..."
    
    rm -f temp/*
    
    print_success "Cleanup completed"
}

# Main deployment function
deploy() {
    print_header
    
    check_requirements
    install_dependencies
    setup_environment
    create_directories
    
    # Only run tests and linting in development
    if [ "$NODE_ENV" = "development" ]; then
        run_tests
        lint_code
    fi
    
    build_project
    start_services
    health_check
    cleanup
    show_status
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "start")
        print_step "Starting VPS-PK Cloud Platform..."
        start_services
        health_check
        show_status
        ;;
    "stop")
        print_step "Stopping VPS-PK Cloud Platform..."
        if [ -f "server.pid" ]; then
            kill $(cat server.pid) 2>/dev/null || true
            rm -f server.pid
            print_success "Server stopped"
        else
            print_error "Server PID file not found"
        fi
        ;;
    "restart")
        print_step "Restarting VPS-PK Cloud Platform..."
        $0 stop
        sleep 2
        $0 start
        ;;
    "status")
        print_step "Checking VPS-PK Cloud Platform status..."
        if [ -f "server.pid" ] && ps -p $(cat server.pid) > /dev/null; then
            print_success "Server is running (PID: $(cat server.pid))"
            curl -s http://$HOST:$PORT/health | jq . 2>/dev/null || echo "Health endpoint not accessible"
        else
            print_error "Server is not running"
        fi
        ;;
    "logs")
        print_step "Showing server logs..."
        if [ -f "logs/server.log" ]; then
            tail -f logs/server.log
        else
            print_error "Log file not found"
        fi
        ;;
    "test")
        print_step "Running tests..."
        run_tests
        ;;
    "lint")
        print_step "Running linting..."
        lint_code
        ;;
    "help"|"-h"|"--help")
        echo "VPS-PK Cloud Platform Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    Full deployment (default)"
        echo "  start     Start the server"
        echo "  stop      Stop the server"
        echo "  restart   Restart the server"
        echo "  status    Check server status"
        echo "  logs      Show server logs"
        echo "  test      Run tests"
        echo "  lint      Run linting"
        echo "  help      Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  PORT      Server port (default: 3000)"
        echo "  HOST      Server host (default: 0.0.0.0)"
        echo "  NODE_ENV  Environment (default: production)"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
