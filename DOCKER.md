# Docker Management for Hasyx

Hasyx provides built-in Docker container support with automatic updates via Watchtower.

## 🚀 Quick Start

### Prerequisites
- Docker installed and running
- Project with `package.json` and `name` field
- Optional: `docker_container_name` field in `package.json` to override image name

### Basic Commands

```bash
# Show help
npx hasyx docker --help

# List running containers
npx hasyx docker ls

# Create and start container (port from .env PORT or 3000)
npx hasyx docker define

# Create and start container on specific port
npx hasyx docker define 8080

# Stop and remove container
npx hasyx docker undefine 8080

# Show container logs
npx hasyx docker logs 8080

# Show last 50 log lines
npx hasyx docker logs 8080 --tail 50

# Show container environment variables
npx hasyx docker env 8080
```

## 🐳 How It Works

### Ports
- **Internal port**: Always `3000` inside container
- **External port**: Specified in `define` command or taken from `PORT` in `.env`
- **Mapping**: `external_port:3000`

### Environment Variables
- All variables from `.env` file are passed to container
- `PORT` is always set to `3000` inside container
- Sensitive values are masked when shown via `docker env`

### Automatic Updates
- Separate Watchtower created for each container
- Watchtower checks for image updates every 30 seconds
- Old images automatically removed after updates

### Container Naming
- **Main container**: `<project_name>-<port>`
- **Watchtower**: `<project_name>-watchtower-<port>`
- **Image**: `<project_name>:latest`

## 📋 Project Setup

### 1. package.json
```json
{
  "name": "my-app",
  "docker_container_name": "custom-name", // optional
  "scripts": {
    "start": "next start",
    "build": "next build"
  }
}
```

### 2. .env file
```env
PORT=3000
POSTGRES_URL=postgresql://user:pass@localhost/db
HASURA_ADMIN_SECRET=secret
NEXTAUTH_SECRET=auth-secret
# ... other variables
```

### 3. Dockerfile
Hasyx automatically creates optimized Dockerfile with multi-stage build.

## 🔧 CI/CD with GitHub Actions

Hasyx creates `.github/workflows/docker-publish.yml` for automatic image publishing:

### Architecture Support
- **Multi-platform builds**: Supports both AMD64 and ARM64 architectures
- **Native dependencies**: Automatically handles compilation for `bufferutil`, `sharp`, and other native modules
- **Build tools**: Includes Python, GCC, and other necessary tools for native compilation

### Security & Environment Variables
**Build-time vs Runtime Variables:**
- **Build-time**: Uses placeholder/dummy values for required variables (not embedded in image)
- **Runtime**: Real sensitive values passed only when container starts

**Required Variables for Build:**
- `NEXT_PUBLIC_HASURA_GRAPHQL_URL` - placeholder used during build
- `NEXTAUTH_SECRET` - placeholder used during build  
- `NEXTAUTH_URL` - placeholder used during build

**Security Benefits:**
- No real secrets embedded in Docker image
- Image can be shared safely
- Secrets only exist in running containers
- Each deployment uses own environment variables

### Setup GitHub Secrets
1. Go to Settings → Secrets and variables → Actions
2. Add secrets:
   - `DOCKER_USERNAME` - Docker Hub username
   - `DOCKER_PASSWORD` - Docker Hub password or access token

### Automatic Publishing
- **Push to main/master** → publish with `latest` tag
- **Push tag v*** → publish with semantic versioning
- **Pull Request** → build only, no publishing

### Troubleshooting Build Issues

**Native Dependencies on ARM64:**
The Dockerfile now includes necessary build tools:
```dockerfile
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    libc6-compat \
    vips-dev
```

**Common Build Errors:**
- `gyp ERR! find Python` → Fixed by installing python3 in Alpine
- `ENOTEMPTY: directory not empty` → Fixed with better npm cache handling
- `bufferutil` compilation errors → Fixed with proper build tools installation

**Build Performance:**
- Uses `.dockerignore` to exclude unnecessary files
- Multi-stage build to reduce final image size
- Build cache optimization with GitHub Actions cache
- Parallel builds for multiple architectures

## 🛠️ Usage Examples

### Local Development
```bash
# Create container for development
npx hasyx docker define 3000

# View logs in real-time
docker logs -f my-app-3000

# Stop when not needed
npx hasyx docker undefine 3000
```

### Production Deployment
```bash
# Create container on production port
npx hasyx docker define 80

# Check status
npx hasyx docker ls

# View environment variables
npx hasyx docker env 80
```

### Monitoring
```bash
# List all project containers
npx hasyx docker ls

# Logs with timestamps
npx hasyx docker logs 3000

# Check environment variables
npx hasyx docker env 3000
```

## 🔍 Troubleshooting

### Docker Not Installed
```bash
# Hasyx will offer to install automatically
npx hasyx docker define
# Or install manually: https://docs.docker.com/engine/install/
```

### Image Not Found
- Ensure image is published to Docker Registry
- Check image name in `package.json`
- Run `docker pull <image_name>:latest` manually

### Container Won't Start
```bash
# Check logs
npx hasyx docker logs <port>

# Check environment variables
npx hasyx docker env <port>

# Test image locally
docker run -it <image_name>:latest sh
```

### Port Already in Use
```bash
# Find what's using the port
sudo netstat -tulpn | grep <port>

# Stop other container
npx hasyx docker undefine <port>
```

## 🎯 Integration with assist

Docker configuration available through interactive assistant:

```bash
npx hasyx assist
# Select Docker setup when prompted
```

This will configure:
- Docker installation check
- PORT variable in .env
- Project information display

## 🔄 Workflow Integration

### GitHub Actions Workflow
The workflow automatically:
- Reads project name from `package.json`
- Uses `docker_container_name` if specified
- Builds multi-platform images (amd64, arm64)
- Publishes to Docker Hub with proper tags
- Updates repository description

### Container Features
- **Restart policy**: `unless-stopped`
- **Health checks**: Built-in endpoint monitoring
- **Security**: Non-root user execution
- **Optimization**: Multi-stage builds, minimal layers
- **Auto-cleanup**: Old images removed automatically 