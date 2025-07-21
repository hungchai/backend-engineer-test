# Backend Engineer Test Cluster

**Cluster documentation:** This file describes the infrastructure, orchestration, and architecture for running the UTXO Blockchain Indexer in a multi-service environment. For a full project overview, API documentation, and test cases, see the main [README in the project root](../README.md).


## Architecture Diagram

A clear view of the production-ready cluster architecture:

```mermaid
graph TB
    subgraph "External Layer"
        Internet[Internet Traffic]
    end
    
    subgraph "Load Balancer Layer"
        LB[HAProxy Load Balancer]
    end
    
    subgraph "API Layer"
        API1[UTXO API Instance 1]
        API2[UTXO API Instance 2]
        API3[UTXO API Instance 3]
    end
    
    subgraph "Database Layer"
        PG_PRIMARY[PostgreSQL Primary]
        PG_REPLICA1[PostgreSQL Replica 1]
        PG_REPLICA2[PostgreSQL Replica 2]
    end
    
    subgraph "Cache & Lock Layer"
        REDIS_CLUSTER[Redis Cluster]
    end
    
    subgraph "Service Discovery"
        CONSUL[Consul Service Registry]
    end
    
    subgraph "Monitoring Stack"
        PROMETHEUS[Prometheus Metrics]
        GRAFANA[Grafana Dashboards]
        JAEGER[Jaeger Tracing]
    end

    Internet --> LB
    LB --> API1
    LB --> API2
    LB --> API3
    
    API1 --> PG_PRIMARY
    API2 --> PG_PRIMARY
    API3 --> PG_PRIMARY
    
    PG_PRIMARY -.-> PG_REPLICA1
    PG_PRIMARY -.-> PG_REPLICA2
    
    API1 --> REDIS_CLUSTER
    API2 --> REDIS_CLUSTER
    API3 --> REDIS_CLUSTER
    
    CONSUL -.-> API1
    CONSUL -.-> API2
    CONSUL -.-> API3
    CONSUL -.-> PG_PRIMARY
    CONSUL -.-> REDIS_CLUSTER
    
    PROMETHEUS -.-> API1
    PROMETHEUS -.-> API2
    PROMETHEUS -.-> API3
    PROMETHEUS -.-> PG_PRIMARY
    PROMETHEUS -.-> REDIS_CLUSTER
    
    GRAFANA --> PROMETHEUS
    
    API1 -.-> JAEGER
    API2 -.-> JAEGER
    API3 -.-> JAEGER
```

## 🚀 Quick Start

This guide provides step-by-step instructions for deploying the UTXO blockchain indexer cluster using Docker Compose or Kubernetes.

## 📋 Prerequisites

### Required Software
- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)
- **Git** (for cloning the repository)
- **OpenSSL** (for SSL certificate generation)

### Optional Software
- **kubectl** (for Kubernetes deployment)
- **Helm** (for Kubernetes package management)

### System Requirements
- **CPU**: 4+ cores (8+ recommended for production)
- **RAM**: 8GB+ (16GB+ recommended for production)
- **Storage**: 50GB+ available space
- **Network**: Internet access for Docker images

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd backend-engineer-test
```

### 2. Navigate to Cluster Directory
```bash
cd backend-engineer-test-cluster
```

### 3. Make Deploy Script Executable
```bash
chmod +x deploy.sh
```

## 🐳 Docker Compose Deployment

### Method 1: Using deploy.sh (Recommended)

The `deploy.sh` script provides automated deployment with SSL certificate generation and health checks.

#### Basic Deployment
```bash
# Deploy with Docker Compose (default)
./deploy.sh docker-compose
```

#### Force SSL Certificate Regeneration
```bash
# Generate fresh SSL certificates and deploy
FORCE_REGENERATE=true ./deploy.sh docker-compose
```

#### Clean Up and Redeploy
```bash
# Remove existing cluster
./deploy.sh cleanup

# Deploy fresh cluster
./deploy.sh docker-compose
```

### Method 2: Direct Docker Compose

For manual control or troubleshooting:

#### Start the Cluster
```bash
# Start all services
docker-compose -f docker-compose.cluster.yml up -d

# View logs
docker-compose -f docker-compose.cluster.yml logs -f
```

#### Stop the Cluster
```bash
# Stop all services
docker-compose -f docker-compose.cluster.yml down

# Stop and remove volumes
docker-compose -f docker-compose.cluster.yml down -v
```

### Method 3: Simple Development Setup

For development with minimal services:

```bash
# Use simple configuration
docker-compose -f docker-compose.simple.yml up -d
```

## ☸️ Kubernetes Deployment

### Prerequisites
- Kubernetes cluster (local or cloud)
- kubectl configured
- Helm (optional)

### Deploy to Kubernetes
```bash
# Deploy with Kubernetes
./deploy.sh kubernetes

# Check deployment status
kubectl get all -n utxo-indexer
```

### Access Services
```bash
# Port forward to access services
kubectl port-forward svc/kong-gateway 8000:8000 -n utxo-indexer
kubectl port-forward svc/grafana 3000:3000 -n utxo-indexer
kubectl port-forward svc/prometheus 9090:9090 -n utxo-indexer
```

## 🔒 SSL Certificate Management

### Automatic Generation
SSL certificates are automatically generated with:
- **Random serial numbers** for security
- **Unique subject names** with timestamps
- **Proper file permissions** (600 for private keys)

### Manual Certificate Management
```bash
# Remove existing certificates
./deploy.sh cleanup-ssl

# Force regenerate certificates
FORCE_REGENERATE=true ./deploy.sh docker-compose
```

### Certificate Details
- **Location**: `ssl/` directory
- **Files**: `utxo-indexer.key`, `utxo-indexer.crt`, `utxo-indexer.pem`
- **Permissions**: Private keys are 600, certificates are 644

## 🌐 Access URLs

After successful deployment, access the services at:

### Docker Compose Deployment
| Service | URL | Credentials |
|---------|-----|-------------|
| **Load Balancer** | http://localhost:80 | - |
| **HAProxy Stats** | http://localhost:8404/stats | - |
| **Kong Admin** | http://localhost:8001 | - |
| **Grafana** | http://localhost:3001 | admin/admin |
| **Prometheus** | http://localhost:9090 | - |
| **Jaeger** | http://localhost:16686 | - |
| **Kibana** | http://localhost:5601 | - |
| **UTXO API** | http://localhost:8080 | - |

### Kubernetes Deployment
| Service | Command | Description |
|---------|---------|-------------|
| **Kong Gateway** | `kubectl port-forward svc/kong-gateway 8000:8000 -n utxo-indexer` | API Gateway |
| **Grafana** | `kubectl port-forward svc/grafana 3000:3000 -n utxo-indexer` | Monitoring Dashboard |
| **Prometheus** | `kubectl port-forward svc/prometheus 9090:9090 -n utxo-indexer` | Metrics Collection |

## 🛠️ Available Commands

### deploy.sh Commands
```bash
# Deploy with Docker Compose
./deploy.sh docker-compose

# Deploy with Kubernetes
./deploy.sh kubernetes

# Clean up cluster
./deploy.sh cleanup

# Remove SSL certificates
./deploy.sh cleanup-ssl

# Run health checks
./deploy.sh health

# Show help
./deploy.sh help
```

### Environment Variables
```bash
# Force SSL certificate regeneration
FORCE_REGENERATE=true ./deploy.sh docker-compose

# Set deployment type
DEPLOYMENT_TYPE=kubernetes ./deploy.sh
```

## 🔍 Health Checks & Monitoring

### Manual Health Checks
```bash
# Check API health
curl http://localhost:8080/health

# Check HAProxy stats
curl http://localhost:8404/stats

# Check Grafana
curl http://localhost:3001/api/health
```

### Automated Health Checks
```bash
# Run all health checks
./deploy.sh health
```

### Monitoring Dashboards
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686 (distributed tracing)

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Conflicts
```bash
# Check what's using the ports
lsof -i :8080
lsof -i :3000
lsof -i :5432

# Stop conflicting services
sudo systemctl stop postgresql
```

#### 2. Docker Issues
```bash
# Check Docker status
docker info

# Restart Docker
sudo systemctl restart docker

# Clean up Docker
docker system prune -f
```

#### 3. SSL Certificate Issues
```bash
# Regenerate certificates
./deploy.sh cleanup-ssl
FORCE_REGENERATE=true ./deploy.sh docker-compose
```

#### 4. Database Connection Issues
```bash
# Check PostgreSQL logs
docker-compose -f docker-compose.cluster.yml logs postgres-primary

# Restart database
docker-compose -f docker-compose.cluster.yml restart postgres-primary
```

### Logs and Debugging
```bash
# View all logs
docker-compose -f docker-compose.cluster.yml logs -f

# View specific service logs
docker-compose -f docker-compose.cluster.yml logs -f utxo-api

# Check container status
docker-compose -f docker-compose.cluster.yml ps
```

## 📊 Performance Tuning

### Resource Limits
The cluster is configured with reasonable defaults, but you can adjust:

#### Docker Compose Resource Limits
```yaml
# In docker-compose.cluster.yml
services:
  utxo-api:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
```

#### Kubernetes Resource Limits
```yaml
# In kubernetes/utxo-cluster.yaml
resources:
  requests:
    memory: "4Gi"
    cpu: "2000m"
  limits:
    memory: "8Gi"
    cpu: "4000m"
```

### Scaling
```bash
# Scale API instances (Docker Compose)
docker-compose -f docker-compose.cluster.yml up -d --scale utxo-api=4

# Scale API instances (Kubernetes)
kubectl scale deployment utxo-api --replicas=4 -n utxo-indexer
```

## 🔒 Security Considerations

### SSL/TLS
- Certificates are automatically generated with random serial numbers
- Private keys have proper permissions (600)
- Certificates are valid for 365 days

### Network Security
- Services communicate over internal Docker network
- External access is controlled via load balancer
- Database is not exposed externally

### Secrets Management
- Database passwords are set via environment variables
- SSL certificates are generated locally
- Kubernetes secrets are base64 encoded (for demo purposes)

## 📈 Production Deployment

### Production Checklist
- [ ] Use proper SSL certificates from CA
- [ ] Configure external load balancer
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategies
- [ ] Implement proper secrets management
- [ ] Set up CI/CD pipelines
- [ ] Configure auto-scaling
- [ ] Set up disaster recovery

### Environment Variables for Production
```bash
# Database
POSTGRES_PASSWORD=<secure-password>
DATABASE_URL=postgresql://user:password@host:5432/database

# API Configuration
NODE_ENV=production
API_PORT=3000
LOG_LEVEL=info

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ADMIN_PASSWORD=<secure-password>
```

## 📚 Additional Resources

### Documentation
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [HAProxy Documentation](https://www.haproxy.org/download/)
- [Kong Documentation](https://docs.konghq.com/)

### Monitoring
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [Jaeger Tracing](https://www.jaegertracing.io/docs/)

### Security
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Kubernetes Security](https://kubernetes.io/docs/concepts/security/)
- [SSL/TLS Configuration](https://ssl-config.mozilla.org/)

---

## 🎯 Quick Reference

### Most Common Commands
```bash
# Start cluster
./deploy.sh docker-compose

# Stop cluster
./deploy.sh cleanup

# Check status
./deploy.sh health

# View logs
docker-compose -f docker-compose.cluster.yml logs -f

# Access Grafana
open http://localhost:3001
```

### Emergency Commands
```bash
# Force restart everything
./deploy.sh cleanup && ./deploy.sh docker-compose

# Regenerate SSL certificates
FORCE_REGENERATE=true ./deploy.sh docker-compose

# Reset database
docker-compose -f docker-compose.cluster.yml down -v && ./deploy.sh docker-compose
```

---

**Happy Deploying! 🚀** 