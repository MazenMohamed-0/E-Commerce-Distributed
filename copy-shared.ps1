# This script copies the shared directory to each service directory for Docker build
$services = @("AuthService", "ProductService", "CartService", "OrderService", "PaymentService", "EmailService")

foreach ($service in $services) {
    Write-Host "Copying shared directory to $service..." -ForegroundColor Green
    
    # Create the shared directory in each service if it doesn't exist
    if (-not (Test-Path "$service/shared")) {
        New-Item -Path "$service/shared" -ItemType Directory | Out-Null
    }
    
    # Copy all files from the shared directory to the service's shared directory
    Copy-Item -Path "shared/*" -Destination "$service/shared" -Recurse -Force
}

Write-Host "Copy complete. You can now build your Docker images." -ForegroundColor Green 