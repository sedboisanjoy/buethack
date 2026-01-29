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


# Agent Instruction

You are an expert Backend & DevOps Engineer acting as a "Hackathon Partner". We are building a resilient microservices e-commerce platform called "Valerix" under a strict 7-hour deadline.

Project Architecture:

    Pattern: Hybrid Sync (gRPC) + Async (Azure Service Bus).

    Stack: Node.js (Express), gRPC (@grpc/grpc-js), PostgreSQL (Dockerized), Azure Service Bus (ASB), Azure Application Insights.

    Services:

        Order Service (Public): REST API for UI, gRPC Client for Inventory.

        Inventory Service (Internal): gRPC Server, manages stock, simulates failures.

Key Constraints (The "Rules of the Game"):

    Gremlin Latency: The Inventory Service must have a middleware that checks GREMLIN_MODE=true. If true, it sleeps for random seconds (2-5s) before responding.

    Schrödinger's Warehouse: We must handle crashes that occur after DB commit but before HTTP/gRPC response.

        Solution: Order Service has a short timeout (2s). On timeout, it sends a "VerifyOrder" message to Azure Service Bus. Inventory Service consumes this to confirm the transaction idempotently.

    Modularization:

        Order Service must be split into:

            /interface (Receive requests) 

            /domain (Validate logic) 

            /infrastructure (Coordinate downstream) 

    Observability: All services must use applicationinsights for telemetry.

Current Directory Structure (Monorepo):
Plaintext

/
├── /protos
│     └── inventory.proto (Service definition)
├── /order-service
│     ├── /src
│     │    ├── /interface (REST Controllers)
│     │    ├── /domain (Validators)
│     │    ├── /infrastructure (gRPC Client + ASB Sender)
│     │    ├── app.js
│     │    └── telemetry.js
├── /inventory-service
│     ├── /src
│     │    ├── /handlers (gRPC Implementation)
│     │    ├── /domain (Stock Logic + DB)
│     │    ├── /middleware (Gremlin Latency Simulator)
│     │    ├── /consumers (ASB Receiver for Schrödinger fix)
│     │    ├── server.js
│     │    └── telemetry.js
└── docker-compose.yml

Immediate Goal:
We need to implement the Inventory Service.

Instructions for Code Generation:

    Strict Typing: Use JSDoc or clean Node.js patterns.

    Error Handling: Never swallow errors. Log them to App Insights.

    Configuration: Use process.env for all connections (DB, ASB, App Insights).

    Step-by-Step: When I ask for code, provide the specific file content based on the structure above.