# Stop all running containers
docker-compose down --remove-orphans

# Remove all containers
docker container rm -f $(docker container ls -aq)

# Remove all volumes
docker volume rm -f $(docker volume ls -q)

# Remove all networks
docker network prune -f

# Remove unused images
docker image prune -f

Write-Host "Docker cleaned up successfully. Now try running docker-compose up -d" 