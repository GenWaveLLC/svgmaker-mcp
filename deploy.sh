#!/bin/bash
set -e

# ----------------------------------------------------------------------------
# Deploy the SVGMaker MCP HTTP server to Google Cloud Run.
#
# This deploys the HTTPS/remote version of the MCP (src/http.ts -> build/http.js),
# which authenticates users via OAuth Bearer tokens (browser login). It does NOT
# affect the published npm/stdio package, which is a separate entry point
# (src/index.ts) that uses an API key.
#
# NOTE: The MCP verifies tokens against, and forwards API calls to, the servers
# named in settings.json (SVGMAKER_AUTH_SERVER_URL / api.svgmaker.io). Those must
# be PUBLIC for the full login flow to work — Cloud Run cannot reach a local
# svgmaker.io running on your Mac. Until svgmaker.io is in production, a deploy
# will pass the health check but the browser-login flow will not complete.
#
# Usage:
#   ./deploy.sh            Build the Docker image, push it, and deploy.
#   ./deploy.sh --update   Skip the build/push; just re-apply settings to the
#                          existing service (e.g. after changing an env var).
# ----------------------------------------------------------------------------

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq first."
    exit 1
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is required but not installed."
    exit 1
fi

# Load settings from settings.json
SETTINGS_FILE="settings.json"
if [ ! -f "$SETTINGS_FILE" ]; then
    echo "Error: settings.json not found in current directory"
    exit 1
fi

echo "Loading configuration from $SETTINGS_FILE..."

# Parse settings
SERVICE_NAME=$(jq -r '.SERVICE_NAME' "$SETTINGS_FILE")
REGION=$(jq -r '.REGION' "$SETTINGS_FILE")
PORT=$(jq -r '.PORT' "$SETTINGS_FILE")
MEMORY=$(jq -r '.MEMORY' "$SETTINGS_FILE")
CPU=$(jq -r '.CPU' "$SETTINGS_FILE")
MIN_INSTANCES=$(jq -r '.MIN_INSTANCES' "$SETTINGS_FILE")
MAX_INSTANCES=$(jq -r '.MAX_INSTANCES' "$SETTINGS_FILE")
CONCURRENCY=$(jq -r '.CONCURRENCY' "$SETTINGS_FILE")
TIMEOUT=$(jq -r '.TIMEOUT' "$SETTINGS_FILE")
MCP_PUBLIC_URL=$(jq -r '.MCP_PUBLIC_URL' "$SETTINGS_FILE")
SVGMAKER_AUTH_SERVER_URL=$(jq -r '.SVGMAKER_AUTH_SERVER_URL' "$SETTINGS_FILE")

# Get GCP project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "Error: No GCP project set. Run: gcloud config set project PROJECT_ID"
    exit 1
fi

echo "Configuration loaded:"
echo "  Service Name:  $SERVICE_NAME"
echo "  Region:        $REGION"
echo "  Project:       $PROJECT_ID"
echo "  Port:          $PORT"
echo "  Memory:        $MEMORY"
echo "  CPU:           $CPU"
echo "  Concurrency:   $CONCURRENCY"
echo "  Min Instances: $MIN_INSTANCES"
echo "  Max Instances: $MAX_INSTANCES"
echo "  Timeout:       ${TIMEOUT}s"
echo "  Public URL:    $MCP_PUBLIC_URL"
echo "  Auth Server:   $SVGMAKER_AUTH_SERVER_URL"
echo ""

# Check for --update flag
UPDATE_MODE=false
if [ "$1" == "--update" ]; then
    UPDATE_MODE=true
    echo "Update mode: Will update existing service with new settings"
else
    echo "Deploy mode: Will build and deploy a new image"
fi

# Image name
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

if [ "$UPDATE_MODE" = false ]; then
    # Build and push Docker image
    echo "Building Docker image..."
    docker build --platform linux/amd64 -t "$IMAGE_NAME" .

    echo "Pushing image to Google Container Registry..."
    docker push "$IMAGE_NAME"
    echo ""
fi

# Deploy to Cloud Run.
# The HTTP transport is token-only: no API key is set here. The only env vars the
# server needs are its own public address and the OAuth auth server address.
echo "Deploying to Cloud Run..."

gcloud run deploy "$SERVICE_NAME" \
    --image="$IMAGE_NAME" \
    --platform=managed \
    --region="$REGION" \
    --allow-unauthenticated \
    --port="$PORT" \
    --memory="$MEMORY" \
    --cpu="$CPU" \
    --concurrency="$CONCURRENCY" \
    --min-instances="$MIN_INSTANCES" \
    --max-instances="$MAX_INSTANCES" \
    --timeout="$TIMEOUT" \
    --set-env-vars="MCP_PUBLIC_URL=${MCP_PUBLIC_URL},SVGMAKER_AUTH_SERVER_URL=${SVGMAKER_AUTH_SERVER_URL}"

echo ""
echo "Deployment complete!"
echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)')
echo "Service URL: $SERVICE_URL"
echo ""
echo "Basic health check (works without the auth server):"
echo "  curl ${SERVICE_URL}/health"
echo ""
echo "Login trigger check (should return 401 with a WWW-Authenticate header):"
echo "  curl -i -X POST ${SERVICE_URL}/mcp"
echo ""
echo "Add to Claude Code (once mcp.svgmaker.io is mapped):"
echo "  claude mcp add --transport http svgmaker ${MCP_PUBLIC_URL}/mcp"
