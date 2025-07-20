# 🚀 UTXO Blockchain Indexer - Cluster Overview

## 🎯 Executive Summary

A production-ready, highly available cluster for the UTXO blockchain indexer with comprehensive middleware stack, designed for scalability, performance, and reliability.

## 📊 Cluster Architecture

### 🏗️ **Multi-Tier Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                     External Layer                         │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Load Balancer │    │   CloudFlare    │                │
│  │   (HAProxy)     │    │      CDN        │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway Layer                        │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  Kong Gateway 1 │    │  Kong Gateway 2 │                │
│  │   (Rate Limit)  │    │   (Rate Limit)  │                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                 Application Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ UTXO API 1  │ │ UTXO API 2  │ │ UTXO API 3  │           │
│  │   (Bun)     │ │   (Bun)     │ │   (Bun)     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                             │
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                              │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ PostgreSQL  │ │Redis Cluster│ │Kafka Cluster│            │
│ │   Primary   │ │ (3 nodes)   │ │ (3 brokers) │            │
│ │ + Replicas  │ │             │ │             │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ **Middleware Stack Components**

| Component | Purpose | High Availability | Scalability |
|-----------|---------|-------------------|-------------|
| **HAProxy** | Load Balancing | ✅ Active-Passive | ✅ Horizontal |
| **Kong Gateway** | API Management | ✅ Multi-Instance | ✅ Auto-scaling |
| **PostgreSQL** | Primary Database | ✅ Master-Replica | ✅ Read Replicas |
| **Redis Cluster** | Distributed Cache | ✅ Clustering | ✅ Sharding |
| **Kafka** | Event Streaming | ✅ Multi-Broker | ✅ Partitioning |
| **Consul** | Service Discovery | ✅ Raft Consensus | ✅ Federation |
| **Prometheus** | Monitoring | ✅ Federation | ✅ Remote Storage |
| **Grafana** | Visualization | ✅ HA Setup | ✅ Multi-Tenant |

## 📈 **Performance Specifications**

### **Throughput Targets**
- **API Requests**: 10,000+ requests/second
- **Block Processing**: 100 blocks/second
- **Balance Queries**: 50,000+ queries/second
- **Database Operations**: 100,000+ operations/second

### **Latency Targets**
- **API Response**: < 50ms (95th percentile)
- **Block Validation**: < 100ms
- **Cache Hit**: < 5ms
- **Database Query**: < 10ms

### **Availability Targets**
- **System Uptime**: 99.9% (8.76 hours/year downtime)
- **Recovery Time**: < 30 seconds
- **Data Durability**: 99.999999999% (11 9's)

## 🚀 **Quick Start Deployment**

### **Option 1: Docker Compose (Recommended for Development)**

```bash
# Clone and navigate
cd cluster

# Deploy full cluster
./deploy.sh docker-compose

# Access services
open http://localhost:80          # Load Balancer
open http://localhost:8404/stats  # HAProxy Stats
open http://localhost:3001        # Grafana (admin/admin)
open http://localhost:9090        # Prometheus
```

### **Option 2: Kubernetes (Production)**

```bash
# Prerequisites: kubectl, helm, k8s cluster

# Deploy to Kubernetes
./deploy.sh kubernetes

# Access services (port-forward)
kubectl port-forward svc/kong-gateway 8000:8000 -n utxo-indexer
kubectl port-forward svc/grafana 3000:3000 -n utxo-indexer
kubectl port-forward svc/prometheus 9090:9090 -n utxo-indexer
```

## 🎛️ **Service Access Points**

### **External Access**
| Service | URL | Purpose |
|---------|-----|---------|
| Load Balancer | `http://localhost:80` | Main API Entry |
| HAProxy Stats | `http://localhost:8404/stats` | Load Balancer Monitoring |
| Kong Admin | `http://localhost:8001` | API Gateway Management |

### **Monitoring & Observability**
| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | `http://localhost:3001` | admin/admin |
| Prometheus | `http://localhost:9090` | None |
| Jaeger | `http://localhost:16686` | None |
| Kibana | `http://localhost:5601` | None |

### **Direct Access (Development)**
| Service | URL | Purpose |
|---------|-----|---------|
| UTXO API | `http://localhost:8080` | Direct API Access |
| PostgreSQL | `localhost:5432` | Database Direct |
| Redis | `localhost:6379` | Cache Direct |

## 🔧 **API Usage Examples**

### **Process Block**
```bash
curl -X POST http://localhost:80/api/v1/blocks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: admin-secret-key-12345" \
  -d '{
    "id": "block-hash-here",
    "height": 1,
    "transactions": [...]
  }'
```

### **Query Balance**
```bash
curl http://localhost:80/api/v1/balance/addr1
```

### **Rollback (Admin Only)**
```bash
curl -X POST "http://localhost:80/api/v1/rollback?height=100" \
  -H "X-API-Key: admin-secret-key-12345"
```

## 📊 **Monitoring Dashboard**

### **Key Metrics to Monitor**

#### **Application Metrics**
- Request rate and latency
- Error rates by endpoint
- Block processing times
- Cache hit/miss ratios

#### **Infrastructure Metrics**
- CPU, Memory, Disk usage
- Network I/O and latency
- Database query performance
- Queue depths and processing rates

#### **Business Metrics**
- Blocks processed per minute
- Total transaction volume
- Active addresses
- System availability

### **Grafana Dashboards**
- **UTXO API Overview**: Application performance
- **Infrastructure Health**: System resources
- **Database Performance**: PostgreSQL metrics
- **Cache Performance**: Redis cluster metrics
- **Network Overview**: Kong and HAProxy metrics

## 🔒 **Security Features**

### **Network Security**
- Private VPC with security groups
- TLS termination at load balancer
- Internal service mesh encryption
- Network policies (Kubernetes)

### **Application Security**
- API rate limiting (Kong)
- Authentication with API keys
- Input validation and sanitization
- SQL injection prevention

### **Access Control**
- Role-based access control (RBAC)
- IP whitelisting for admin operations
- Audit logging for all operations
- Secrets management

## 📈 **Scaling Strategies**

### **Horizontal Scaling**
```bash
# Docker Compose
docker-compose -f docker-compose.cluster.yml up -d --scale utxo-api=5

# Kubernetes
kubectl scale deployment utxo-api --replicas=5 -n utxo-indexer
```

### **Vertical Scaling**
- CPU/Memory limits in containers
- Database instance sizing
- Cache memory allocation
- Storage performance tiers

### **Auto-scaling (Kubernetes)**
- Horizontal Pod Autoscaler (HPA)
- Vertical Pod Autoscaler (VPA)
- Cluster Autoscaler for nodes
- Custom metrics scaling

## 🛡️ **High Availability Features**

### **Component Redundancy**
- **Load Balancer**: Active-passive HAProxy
- **API Gateway**: Multiple Kong instances
- **Application**: 3+ API instances
- **Database**: Primary + read replicas
- **Cache**: Redis cluster with failover
- **Messaging**: Kafka cluster with replication

### **Failure Recovery**
- **Health Checks**: Automated failure detection
- **Circuit Breakers**: Prevent cascade failures
- **Graceful Degradation**: Serve cached data
- **Auto-healing**: Restart failed containers

### **Data Protection**
- **Database Backups**: Automated daily backups
- **Point-in-time Recovery**: Transaction log replay
- **Cross-region Replication**: Disaster recovery
- **Data Validation**: Integrity checks

## 🔄 **Deployment Strategies**

### **Blue-Green Deployment**
- Zero-downtime deployments
- Instant rollback capability
- Full environment validation
- Traffic switching

### **Rolling Updates**
- Gradual instance replacement
- Continuous service availability
- Resource-efficient updates
- Kubernetes native

### **Canary Releases**
- Gradual traffic shifting
- A/B testing capability
- Risk mitigation
- Performance validation

## 📋 **Operational Procedures**

### **Daily Operations**
- Monitor dashboards and alerts
- Check system health and capacity
- Review error logs and metrics
- Verify backup completion

### **Weekly Operations**
- Performance trend analysis
- Capacity planning review
- Security audit and updates
- Disaster recovery testing

### **Emergency Procedures**
- Incident response playbook
- Service recovery procedures
- Data recovery protocols
- Communication escalation

## 🎯 **Performance Tuning**

### **Database Optimization**
- Connection pooling configuration
- Query optimization and indexing
- Read replica load balancing
- Maintenance window scheduling

### **Cache Optimization**
- Memory allocation tuning
- Eviction policy configuration
- Cache warming strategies
- Hit ratio optimization

### **Network Optimization**
- Load balancer configuration
- Connection keep-alive settings
- Compression and caching
- CDN integration

## 📞 **Support & Troubleshooting**

### **Health Checks**
```bash
# Overall cluster health
./deploy.sh health

# Component-specific checks
curl http://localhost:8404/stats  # HAProxy
curl http://localhost:8080/health # UTXO API
curl http://localhost:9090/api/v1/query?query=up  # Prometheus
```

### **Log Analysis**
```bash
# Docker Compose
docker-compose -f docker-compose.cluster.yml logs [service]

# Kubernetes
kubectl logs -f deployment/utxo-api -n utxo-indexer
kubectl logs -f deployment/kong-gateway -n utxo-indexer
```

### **Performance Debugging**
- Use Jaeger for distributed tracing
- Monitor Prometheus metrics
- Analyze Grafana dashboards
- Check HAProxy statistics

## 🚀 **Production Readiness Checklist**

### **Before Production**
- [ ] Security audit completed
- [ ] Performance testing passed
- [ ] Backup and recovery tested
- [ ] Monitoring and alerting configured
- [ ] Documentation updated
- [ ] Team training completed

### **Production Deployment**
- [ ] Infrastructure provisioned
- [ ] Secrets and certificates configured
- [ ] DNS and load balancers set up
- [ ] Monitoring systems deployed
- [ ] Backup systems active
- [ ] Team on-call schedule established

---

## 🎉 **Ready for Production!**

This cluster design provides enterprise-grade reliability, scalability, and performance for the UTXO blockchain indexer. With comprehensive monitoring, automated deployment, and battle-tested middleware components, it's ready to handle production workloads at scale.

**Happy clustering! 🚀** 

### 🛡️ API Gateway & Service Discovery
Kong instances (`api-gateway-1`, `api-gateway-2`) leverage **Consul DNS** to route incoming traffic to healthy `utxo-api-*` back-end services. Each application pod automatically registers/deregisters under the `utxo-api` service name, enabling:
- **Dynamic scaling** without Kong reloads.
- **Health-aware routing** (only passing healthy targets).
- **Blue-Green deployments** where new versions register side-by-side with old ones until healthy. 