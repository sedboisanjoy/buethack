#!/bin/bash
# ============================================
# Valerix Kubernetes Deployment Script
# ============================================

set -e

NAMESPACE="valerix"

echo "=========================================="
echo "  Valerix Kubernetes Deployment"
echo "=========================================="

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl is not installed"
    exit 1
fi

# Check cluster connection
echo "Checking cluster connection..."
kubectl cluster-info || { echo "Error: Cannot connect to cluster"; exit 1; }

# Create namespace if it doesn't exist
echo "Creating namespace: $NAMESPACE"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Create ConfigMaps for init.sql files
echo "Creating ConfigMaps for database initialization..."
kubectl create configmap order-init-sql \
    --from-file=init.sql=./order-service/init.sql \
    -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap inventory-init-sql \
    --from-file=init.sql=./inventory-service/init.sql \
    -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Build and push Docker images (if using a registry)
echo ""
echo "Building Docker images..."
docker-compose build

# Tag images for registry (customize this for your registry)
# Example for Docker Hub:
# docker tag valerixy-order-service:latest yourusername/valerixy-order-service:latest
# docker push yourusername/valerixy-order-service:latest

# Apply Kubernetes manifests
echo ""
echo "Applying Kubernetes manifests..."
kubectl apply -f ./k8s/deployment.yaml

# Wait for deployments
echo ""
echo "Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/order-db -n $NAMESPACE
kubectl wait --for=condition=available --timeout=120s deployment/inventory-db -n $NAMESPACE
kubectl wait --for=condition=available --timeout=120s deployment/order-service -n $NAMESPACE
kubectl wait --for=condition=available --timeout=120s deployment/inventory-service -n $NAMESPACE
kubectl wait --for=condition=available --timeout=120s deployment/dashboard -n $NAMESPACE
kubectl wait --for=condition=available --timeout=120s deployment/frontend -n $NAMESPACE

# Show deployment status
echo ""
echo "=========================================="
echo "  Deployment Status"
echo "=========================================="
kubectl get pods -n $NAMESPACE
echo ""
kubectl get services -n $NAMESPACE

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "To access the services locally, use port-forwarding:"
echo "  kubectl port-forward svc/frontend 8080:80 -n $NAMESPACE"
echo "  kubectl port-forward svc/order-service 3001:3001 -n $NAMESPACE"
echo "  kubectl port-forward svc/dashboard 3003:3003 -n $NAMESPACE"
echo ""
echo "Or configure your ingress controller for external access."
