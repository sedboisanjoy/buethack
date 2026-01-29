# 📦 Valerix: Resilient E-Commerce Microservices

> **Hackathon Solution** for FrostByte Logistics & Valerix.
> *High-Reliability Order & Inventory Management System.*

## 🚀 Overview
This project decomposes a monolithic e-commerce system into a resilient microservices architecture. It allows the **Order Service** and **Inventory Service** to maintain data consistency even under severe network latency ("Gremlin") and process crashes ("Schrödinger's Warehouse").

### 🏗 Architecture
* **Communication:** Hybrid **gRPC** (High-performance sync) + **Azure Service Bus** (Reliability async fallback).
* **Observability:** Azure Application Insights for distributed tracing and live metrics.
* **Database:** PostgreSQL (Dockerized).

---

## 🛠️ Prerequisites
* **Docker & Docker Compose**
* **Node.js v18+** (for local testing outside Docker)
* **Azure Service Bus Namespace** (Standard Tier) - *Connection String required.*
* **Azure Application Insights** - *Connection String required.*

---

## ⚙️ Configuration
Create a `.env` file in the root directory (or configure `docker-compose.yml` directly):

```ini
# Shared Configuration
POSTGRES_USER=admin
POSTGRES_PASSWORD=password
POSTGRES_DB=valerix_db

# Azure Connectivity
# (Use the "RootManageSharedAccessKey" for Hackathon speed)
SERVICE_BUS_CONNECTION_STRING="Endpoint=sb://your-ns.servicebus.windows.net/;..."
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=..."

# Chaos Engineering Toggles
# Set to 'true' to simulate 3-5s random latency in Inventory Service
GREMLIN_MODE=false