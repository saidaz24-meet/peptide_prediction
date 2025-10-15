set -euo pipefail

echo "Building Tango Docker image..."

# Build the Docker image (forcing x86_64 architecture for compatibility)
docker build --platform linux/amd64 -t desy-tango .

echo "Docker image 'desy-tango' built successfully!"
echo ""
echo "To test the container, run:"
echo "  docker run --rm -v \$(pwd):/app/Tango -w /app/Tango desy-tango -c './tango --help'"
echo ""
echo "The Python code will now use this image automatically when TANGO_USE_DOCKER=1"
