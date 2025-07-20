#!/bin/bash

# UTXO Blockchain Indexer - Cluster Deployment Script
# Supports Docker Compose and Kubernetes deployments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="utxo-indexer-cluster"
NAMESPACE="utxo-indexer"
DEPLOYMENT_TYPE=${1:-docker-compose}

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    case $DEPLOYMENT_TYPE in
        "docker-compose")
            if ! command -v docker &> /dev/null; then
                log_error "Docker is not installed"
                exit 1
            fi
            if ! command -v docker-compose &> /dev/null; then
                log_error "Docker Compose is not installed"
                exit 1
            fi
            ;;
        "kubernetes")
            if ! command -v kubectl &> /dev/null; then
                log_error "kubectl is not installed"
                exit 1
            fi
            if ! command -v helm &> /dev/null; then
                log_warning "Helm is not installed (optional but recommended)"
            fi
            ;;
        *)
            log_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            echo "Usage: $0 [docker-compose|kubernetes]"
            exit 1
            ;;
    esac
    
    log_success "Dependencies check passed"
}

setup_ssl_certificates() {
    log_info "Setting up SSL certificates..."
    
    mkdir -p ssl
    
    # Check if we should force regenerate certificates
    FORCE_REGENERATE=${FORCE_REGENERATE:-false}
    
    if [ "$FORCE_REGENERATE" = "true" ] || [ ! -f ssl/utxo-indexer.pem ]; then
        log_info "Generating self-signed SSL certificate..."
        
        # Generate random serial number for better security
        SERIAL=$(openssl rand -hex 16)
        
        # Generate random subject with timestamp for uniqueness
        TIMESTAMP=$(date +%s)
        SUBJECT="/C=US/ST=State/L=City/O=UTXO-Indexer/CN=utxo-indexer-${TIMESTAMP}.local"
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/utxo-indexer.key \
            -out ssl/utxo-indexer.crt \
            -subj "$SUBJECT" \
            -set_serial "0x${SERIAL}"
        
        # Combine for HAProxy
        cat ssl/utxo-indexer.crt ssl/utxo-indexer.key > ssl/utxo-indexer.pem
        
        # Set proper permissions
        chmod 600 ssl/utxo-indexer.key
        chmod 644 ssl/utxo-indexer.crt
        chmod 600 ssl/utxo-indexer.pem
        
        log_success "SSL certificates generated with random serial: ${SERIAL}"
    else
        log_info "SSL certificates already exist (use FORCE_REGENERATE=true to regenerate)"
    fi
}

init_redis_cluster() {
    log_info "Initializing Redis cluster..."
    
    # Wait for Redis nodes to be ready
    sleep 10
    
    if [ "$DEPLOYMENT_TYPE" == "docker-compose" ]; then
        docker exec utxo-redis-1 redis-cli --cluster create \
            redis-cluster-1:6379 redis-cluster-2:6379 redis-cluster-3:6379 \
            --cluster-replicas 0 --cluster-yes || true
    fi
    
    log_success "Redis cluster initialized"
}

deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."
    
    # Create network if it doesn't exist
    docker network create utxo-network 2>/dev/null || true
    
    # Build the UTXO indexer image
    log_info "Building UTXO indexer image..."
    docker build -t utxo-indexer:latest ../
    
    # Deploy the cluster
    log_info "Starting cluster services..."
    docker-compose -f docker-compose.cluster.yml up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Initialize Redis cluster
    init_redis_cluster
    
    # Show service status
    docker-compose -f docker-compose.cluster.yml ps
    
    log_success "Docker Compose deployment completed"
    
    # Display access information
    echo ""
    echo "🎉 Cluster is now running!"
    echo ""
    echo "🌐 Access URLs:"
    echo "   Load Balancer:    http://localhost:80"
    echo "   HAProxy Stats:    http://localhost:8404/stats"
    echo "   Kong Admin:       http://localhost:8001"
    echo "   Grafana:          http://localhost:3001 (admin/admin)"
    echo "   Prometheus:       http://localhost:9090"
    echo "   Jaeger:           http://localhost:16686"
    echo "   Kibana:           http://localhost:5601"
    echo ""
    echo "🔧 Direct API Access: http://localhost:8080"
    echo ""
}

deploy_kubernetes() {
    log_info "Deploying with Kubernetes..."
    
    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot access Kubernetes cluster"
        exit 1
    fi
    
    # Create namespace
    log_info "Creating namespace..."
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Create ConfigMaps
    log_info "Creating ConfigMaps..."
    kubectl create configmap haproxy-config \
        --from-file=haproxy/haproxy.cfg \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    kubectl create configmap kong-config \
        --from-file=kong/kong.yml \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    kubectl create configmap redis-config \
        --from-file=redis/redis-cluster.conf \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    kubectl create configmap prometheus-config \
        --from-file=prometheus/prometheus.yml \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Build and push image (assuming registry access)
    log_info "Building and tagging image for Kubernetes..."
    docker build -t utxo-indexer:latest ../
    
    # Apply Kubernetes manifests
    log_info "Applying Kubernetes manifests..."
    kubectl apply -f kubernetes/utxo-cluster.yaml
    
    # Wait for deployments to be ready
    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment --all -n $NAMESPACE
    
    # Show status
    kubectl get all -n $NAMESPACE
    
    log_success "Kubernetes deployment completed"
    
    # Display access information
    echo ""
    echo "🎉 Cluster is now running on Kubernetes!"
    echo ""
    echo "🌐 Access URLs (use port-forward or ingress):"
    echo "   Kong Gateway:     kubectl port-forward svc/kong-gateway 8000:8000 -n $NAMESPACE"
    echo "   Grafana:          kubectl port-forward svc/grafana 3000:3000 -n $NAMESPACE"
    echo "   Prometheus:       kubectl port-forward svc/prometheus 9090:9090 -n $NAMESPACE"
    echo ""
}

monitoring_setup() {
    log_info "Setting up monitoring and alerting..."
    
    if [ "$DEPLOYMENT_TYPE" == "docker-compose" ]; then
        # Check if Grafana is accessible
        until curl -f http://localhost:3001/api/health &>/dev/null; do
            log_info "Waiting for Grafana to be ready..."
            sleep 5
        done
        
        # Import dashboards (if available)
        log_info "Grafana is ready for dashboard import"
    else
        log_info "Use kubectl port-forward to access monitoring services"
    fi
}

run_health_checks() {
    log_info "Running health checks..."
    
    if [ "$DEPLOYMENT_TYPE" == "docker-compose" ]; then
        # Check API health
        if curl -f http://localhost:8080/health &>/dev/null; then
            log_success "UTXO API is healthy"
        else
            log_warning "UTXO API health check failed"
        fi
        
        # Check HAProxy stats
        if curl -f http://localhost:8404/stats &>/dev/null; then
            log_success "HAProxy is healthy"
        else
            log_warning "HAProxy health check failed"
        fi
    else
        log_info "Use kubectl to check pod health in namespace $NAMESPACE"
    fi
}

cleanup() {
    log_info "Cleaning up cluster..."
    
    if [ "$DEPLOYMENT_TYPE" == "docker-compose" ]; then
        docker-compose -f docker-compose.cluster.yml down -v
        docker system prune -f
    else
        kubectl delete namespace $NAMESPACE --ignore-not-found=true
    fi
    
    log_success "Cleanup completed"
}

cleanup_ssl() {
    log_info "Cleaning up SSL certificates..."
    
    if [ -d ssl ]; then
        rm -rf ssl/*
        log_success "SSL certificates removed"
    else
        log_info "No SSL certificates to clean up"
    fi
}

show_help() {
    echo "UTXO Blockchain Indexer - Cluster Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  docker-compose    Deploy using Docker Compose (default)"
    echo "  kubernetes        Deploy using Kubernetes"
    echo "  cleanup           Remove the cluster"
    echo "  cleanup-ssl       Remove SSL certificates"
    echo "  health            Run health checks"
    echo "  help              Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  FORCE_REGENERATE=true  Force regenerate SSL certificates"
    echo "  DEPLOYMENT_TYPE        Set deployment type (docker-compose|kubernetes)"
    echo ""
    echo "Examples:"
    echo "  $0 docker-compose                    # Deploy with Docker Compose"
    echo "  $0 kubernetes                        # Deploy with Kubernetes"
    echo "  $0 cleanup                           # Remove all cluster resources"
    echo "  FORCE_REGENERATE=true $0 docker-compose  # Deploy with fresh SSL certs"
    echo ""
    echo "SSL Certificate Management:"
    echo "  - Certificates are generated automatically with random serial numbers"
    echo "  - Use FORCE_REGENERATE=true to generate new certificates"
    echo "  - Use cleanup-ssl to remove existing certificates"
    echo ""
}

# Main execution
case "$1" in
    "docker-compose")
        check_dependencies
        setup_ssl_certificates
        deploy_docker_compose
        monitoring_setup
        run_health_checks
        ;;
    "kubernetes")
        check_dependencies
        setup_ssl_certificates
        deploy_kubernetes
        monitoring_setup
        run_health_checks
        ;;
    "cleanup")
        cleanup
        ;;
    "cleanup-ssl")
        cleanup_ssl
        ;;
    "health")
        run_health_checks
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    "")
        check_dependencies
        setup_ssl_certificates
        deploy_docker_compose
        monitoring_setup
        run_health_checks
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac 