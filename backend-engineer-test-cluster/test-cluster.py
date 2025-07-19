#!/usr/bin/env python3
"""
UTXO Blockchain Indexer - Cluster Test Suite (Python)
Advanced testing with detailed reporting and metrics collection
"""

import asyncio
import aiohttp
import json
import time
import sys
import subprocess
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import concurrent.futures

# Configuration
@dataclass
class ClusterConfig:
    base_url: str = "http://localhost"
    lb_port: int = 80
    api_ports: Optional[List[int]] = None
    prometheus_port: int = 9091
    grafana_port: int = 3004
    haproxy_stats_port: int = 8404
    
    def __post_init__(self):
        if self.api_ports is None:
            self.api_ports = [3001, 3002, 3003]

@dataclass
class TestResult:
    name: str
    passed: bool
    duration: float
    message: str
    response_data: Optional[Dict] = None

class ClusterTester:
    def __init__(self, config: ClusterConfig):
        self.config = config
        self.results: List[TestResult] = []
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=100)
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_info(self, message: str):
        print(f"🔍 [INFO] {message}")
    
    def log_success(self, message: str):
        print(f"✅ [PASS] {message}")
    
    def log_error(self, message: str):
        print(f"❌ [FAIL] {message}")
    
    def log_warning(self, message: str):
        print(f"⚠️  [WARN] {message}")
    
    async def test_http_endpoint(
        self,
        name: str,
        method: str,
        url: str,
        data: Optional[Dict] = None,
        expected_status: int = 200,
        headers: Optional[Dict] = None
    ) -> TestResult:
        """Test HTTP endpoint with detailed timing and response analysis"""
        
        start_time = time.time()
        
        try:
            if headers is None:
                headers = {'Content-Type': 'application/json'}
            
            if not self.session:
                raise Exception("Session not initialized")
            
            async with self.session.request(
                method=method,
                url=url,
                json=data,
                headers=headers
            ) as response:
                duration = time.time() - start_time
                response_text = await response.text()
                
                try:
                    response_data = json.loads(response_text) if response_text else None
                except json.JSONDecodeError:
                    response_data = {"raw_response": response_text}
                
                passed = response.status == expected_status
                message = f"Status: {response.status}, Duration: {duration:.3f}s"
                
                result = TestResult(
                    name=name,
                    passed=passed,
                    duration=duration,
                    message=message,
                    response_data=response_data
                )
                
                self.results.append(result)
                
                if passed:
                    self.log_success(f"{name} - {message}")
                else:
                    self.log_error(f"{name} - Expected {expected_status}, got {response.status}")
                    if response_data:
                        print(f"Response: {json.dumps(response_data, indent=2)[:200]}...")
                
                return result
                
        except Exception as e:
            duration = time.time() - start_time
            result = TestResult(
                name=name,
                passed=False,
                duration=duration,
                message=f"Exception: {str(e)}"
            )
            self.results.append(result)
            self.log_error(f"{name} - {str(e)}")
            return result
    
    async def test_container_health(self) -> None:
        """Test Docker container health"""
        self.log_info("Testing container health...")
        
        try:
            result = subprocess.run(
                ["docker-compose", "-f", "docker-compose.simple.yml", "ps"],
                capture_output=True,
                text=True,
                cwd="."
            )
            
            if result.returncode == 0:
                self.log_success("Docker containers are running")
                print(result.stdout)
            else:
                self.log_error(f"Docker containers check failed: {result.stderr}")
                
        except Exception as e:
            self.log_error(f"Container health check failed: {str(e)}")
    
    async def test_database_connectivity(self) -> None:
        """Test database connections"""
        self.log_info("Testing database connectivity...")
        
        # Test PostgreSQL
        try:
            result = subprocess.run(
                ["docker", "exec", "utxo-postgres-primary", "pg_isready", "-U", "postgres"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                self.log_success("PostgreSQL is accessible")
            else:
                self.log_error("PostgreSQL connection failed")
                
        except Exception as e:
            self.log_error(f"PostgreSQL test failed: {str(e)}")
        
        # Test Redis
        try:
            result = subprocess.run(
                ["docker", "exec", "utxo-redis-1", "redis-cli", "ping"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0 and "PONG" in result.stdout:
                self.log_success("Redis is accessible")
            else:
                self.log_error("Redis connection failed")
                
        except Exception as e:
            self.log_error(f"Redis test failed: {str(e)}")
    
    async def test_api_instances(self) -> None:
        """Test individual API instances"""
        self.log_info("Testing individual API instances...")
        
        tasks = []
        api_ports = self.config.api_ports or [3001, 3002, 3003]
        for port in api_ports:
            url = f"{self.config.base_url}:{port}/health"
            task = self.test_http_endpoint(f"API Instance :{port} Health", "GET", url)
            tasks.append(task)
        
        await asyncio.gather(*tasks)
    
    async def test_load_balancer(self) -> None:
        """Test load balancer functionality"""
        self.log_info("Testing load balancer...")
        
        # Test HAProxy stats
        stats_url = f"{self.config.base_url}:{self.config.haproxy_stats_port}/stats"
        await self.test_http_endpoint("HAProxy Stats", "GET", stats_url)
        
        # Test load balanced requests
        self.log_info("Testing load distribution...")
        tasks = []
        for i in range(10):
            url = f"{self.config.base_url}:{self.config.lb_port}/health"
            task = self.test_http_endpoint(f"Load Balanced Request #{i+1}", "GET", url)
            tasks.append(task)
        
        await asyncio.gather(*tasks)
    
    async def test_blockchain_functionality(self) -> None:
        """Test blockchain operations"""
        self.log_info("Testing blockchain functionality...")
        
        base_url = f"{self.config.base_url}:{self.config.lb_port}"
        
        # Test root endpoint
        await self.test_http_endpoint("API Root", "GET", f"{base_url}/")
        
        # Test metrics endpoint
        await self.test_http_endpoint("Metrics Endpoint", "GET", f"{base_url}/metrics")
        
        # Test Genesis Block
        genesis_block = {
            "id": "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9",
            "height": 1,
            "transactions": [{
                "id": "tx1",
                "inputs": [],
                "outputs": [{"address": "addr1", "value": 100}]
            }]
        }
        
        await self.test_http_endpoint(
            "Genesis Block Processing",
            "POST",
            f"{base_url}/blocks",
            genesis_block
        )
        
        # Wait for processing
        await asyncio.sleep(2)
        
        # Test balance query
        await self.test_http_endpoint(
            "Balance Query (addr1)",
            "GET",
            f"{base_url}/balance/addr1"
        )
        
        # Test transfer transaction
        transfer_block = {
            "id": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
            "height": 2,
            "transactions": [{
                "id": "tx2",
                "inputs": [{"txId": "tx1", "index": 0}],
                "outputs": [
                    {"address": "addr2", "value": 60},
                    {"address": "addr3", "value": 40}
                ]
            }]
        }
        
        await self.test_http_endpoint(
            "Transfer Transaction",
            "POST",
            f"{base_url}/blocks",
            transfer_block
        )
        
        # Wait for processing
        await asyncio.sleep(2)
        
        # Test balance queries after transfer
        balance_tasks = [
            self.test_http_endpoint("Balance Query (addr1 after transfer)", "GET", f"{base_url}/balance/addr1"),
            self.test_http_endpoint("Balance Query (addr2)", "GET", f"{base_url}/balance/addr2"),
            self.test_http_endpoint("Balance Query (addr3)", "GET", f"{base_url}/balance/addr3"),
        ]
        
        await asyncio.gather(*balance_tasks)
        
        # Test rollback
        await self.test_http_endpoint(
            "Rollback to Height 1",
            "POST",
            f"{base_url}/rollback?height=1"
        )
        
        # Wait for rollback processing
        await asyncio.sleep(2)
        
        # Test balances after rollback
        rollback_tasks = [
            self.test_http_endpoint("Balance Query (addr1 after rollback)", "GET", f"{base_url}/balance/addr1"),
            self.test_http_endpoint("Balance Query (addr2 after rollback)", "GET", f"{base_url}/balance/addr2"),
        ]
        
        await asyncio.gather(*rollback_tasks)
    
    async def test_monitoring_stack(self) -> None:
        """Test monitoring services"""
        self.log_info("Testing monitoring stack...")
        
        # Test Prometheus
        prometheus_url = f"{self.config.base_url}:{self.config.prometheus_port}"
        await self.test_http_endpoint("Prometheus Health", "GET", f"{prometheus_url}/")
        await self.test_http_endpoint("Prometheus Targets", "GET", f"{prometheus_url}/api/v1/targets")
        
        # Test Grafana
        grafana_url = f"{self.config.base_url}:{self.config.grafana_port}"
        await self.test_http_endpoint("Grafana Health", "GET", f"{grafana_url}/api/health")
    
    async def test_error_handling(self) -> None:
        """Test error handling scenarios"""
        self.log_info("Testing error handling...")
        
        base_url = f"{self.config.base_url}:{self.config.lb_port}"
        
        # Test invalid block
        invalid_block = {"invalid": "block"}
        await self.test_http_endpoint(
            "Invalid Block Processing",
            "POST",
            f"{base_url}/blocks",
            invalid_block,
            expected_status=400
        )
        
        # Test non-existent address
        await self.test_http_endpoint(
            "Non-existent Address Balance",
            "GET",
            f"{base_url}/balance/nonexistent"
        )
        
        # Test invalid rollback
        await self.test_http_endpoint(
            "Invalid Rollback Height",
            "POST",
            f"{base_url}/rollback?height=-1",
            expected_status=400
        )
    
    async def test_performance(self) -> None:
        """Test performance under load"""
        self.log_info("Testing performance under concurrent load...")
        
        base_url = f"{self.config.base_url}:{self.config.lb_port}"
        
        # Concurrent health checks
        start_time = time.time()
        tasks = []
        for i in range(50):
            task = self.test_http_endpoint(f"Concurrent Health Check #{i+1}", "GET", f"{base_url}/health")
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        duration = time.time() - start_time
        
        successful_requests = sum(1 for r in results if r.passed)
        avg_response_time = sum(r.duration for r in results) / len(results)
        
        self.log_info(f"Performance Test Results:")
        print(f"  Total Requests: {len(results)}")
        print(f"  Successful: {successful_requests}")
        print(f"  Failed: {len(results) - successful_requests}")
        print(f"  Total Duration: {duration:.3f}s")
        print(f"  Requests/sec: {len(results)/duration:.2f}")
        print(f"  Avg Response Time: {avg_response_time:.3f}s")
    
    def generate_report(self) -> Dict:
        """Generate comprehensive test report"""
        passed_tests = [r for r in self.results if r.passed]
        failed_tests = [r for r in self.results if not r.passed]
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_tests": len(self.results),
                "passed": len(passed_tests),
                "failed": len(failed_tests),
                "success_rate": len(passed_tests) / len(self.results) * 100 if self.results else 0,
                "total_duration": sum(r.duration for r in self.results),
                "avg_response_time": sum(r.duration for r in self.results) / len(self.results) if self.results else 0
            },
            "failed_tests": [
                {
                    "name": r.name,
                    "message": r.message,
                    "duration": r.duration
                }
                for r in failed_tests
            ],
            "performance_metrics": {
                "fastest_test": min(self.results, key=lambda r: r.duration) if self.results else None,
                "slowest_test": max(self.results, key=lambda r: r.duration) if self.results else None,
            }
        }
        
        return report
    
    def print_summary(self):
        """Print test summary"""
        report = self.generate_report()
        summary = report["summary"]
        
        print("\n" + "="*50)
        print("🔍 CLUSTER TEST SUMMARY")
        print("="*50)
        print(f"📊 Total Tests: {summary['total_tests']}")
        print(f"✅ Passed: {summary['passed']}")
        print(f"❌ Failed: {summary['failed']}")
        print(f"📈 Success Rate: {summary['success_rate']:.1f}%")
        print(f"⏱️  Total Duration: {summary['total_duration']:.2f}s")
        print(f"⚡ Avg Response Time: {summary['avg_response_time']:.3f}s")
        
        if report["failed_tests"]:
            print("\n❌ FAILED TESTS:")
            for test in report["failed_tests"]:
                print(f"  - {test['name']}: {test['message']}")
        
        if summary['failed'] == 0:
            print("\n🎉 All tests passed! Cluster is healthy.")
            return True
        else:
            print(f"\n⚠️  {summary['failed']} tests failed. Check cluster configuration.")
            return False

async def main():
    """Main test execution"""
    print("🚀 Starting UTXO Indexer Cluster Tests (Python)")
    print("=" * 55)
    
    config = ClusterConfig()
    
    async with ClusterTester(config) as tester:
        # Wait for services to be ready
        print("⏳ Waiting for services to be ready...")
        await asyncio.sleep(10)
        
        # Run test suites
        try:
            await tester.test_container_health()
            await tester.test_database_connectivity()
            await tester.test_api_instances()
            await tester.test_load_balancer()
            await tester.test_blockchain_functionality()
            await tester.test_monitoring_stack()
            await tester.test_error_handling()
            await tester.test_performance()
            
        except Exception as e:
            print(f"❌ Test execution failed: {str(e)}")
            return False
        
        # Generate and display report
        success = tester.print_summary()
        
        # Save detailed report to file
        report = tester.generate_report()
        with open("cluster-test-report.json", "w") as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"\n📄 Detailed report saved to: cluster-test-report.json")
        
        return success

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        sys.exit(1) 