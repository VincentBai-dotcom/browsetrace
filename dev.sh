#!/bin/bash

# BrowseTrace Development Script
# Starts Go server and Electron desktop app concurrently

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the root directory of the monorepo
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
DESKTOP_DIR="$ROOT_DIR/desktop"
EXTENSION_DIR="$ROOT_DIR/browser-extension"
MCP_SERVER_DIR="$ROOT_DIR/mcp-server"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  BrowseTrace Development Environment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${RED}Error: Go is not installed${NC}"
    echo "Please install Go from https://golang.org/dl/"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm is not installed${NC}"
    echo "Please install pnpm: npm install -g pnpm"
    exit 1
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"

    # Kill all background jobs
    jobs -p | xargs -r kill 2>/dev/null

    # Wait for processes to terminate
    wait 2>/dev/null

    echo -e "${GREEN}All processes stopped${NC}"
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup SIGINT SIGTERM

# Check if desktop dependencies are installed
if [ ! -d "$DESKTOP_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing desktop app dependencies...${NC}"
    cd "$DESKTOP_DIR"
    pnpm install
    echo ""
fi

# Check if browser extension dependencies are installed
if [ ! -d "$EXTENSION_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing browser extension dependencies...${NC}"
    cd "$EXTENSION_DIR"
    pnpm install
    echo ""
fi

# Check if mcp-server dependencies are installed
if [ ! -d "$MCP_SERVER_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing MCP server dependencies...${NC}"
    cd "$MCP_SERVER_DIR"
    pnpm install
    echo ""
fi

# Build browser extension first (wait for completion)
echo -e "${GREEN}[1/4] Building Browser Extension...${NC}"
cd "$EXTENSION_DIR"
pnpm build

# Start browser extension in watch mode (background)
echo -e "${GREEN}      Starting watch mode for extension...${NC}"
pnpm dev 2>&1 | sed "s/^/[EXTENSION] /" &
EXTENSION_PID=$!

# Wait for watch mode to initialize
sleep 3

# Start Go server in background
echo -e "${GREEN}[2/4] Starting Go HTTP Server...${NC}"
cd "$SERVER_DIR"
go run ./cmd/browsetrace-agent 2>&1 | sed "s/^/[SERVER] /" &
SERVER_PID=$!

# Wait a bit for server to start
sleep 2

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}Error: Go server failed to start${NC}"
    exit 1
fi

# Build MCP server
echo -e "${GREEN}[3/4] Building MCP Server...${NC}"
cd "$MCP_SERVER_DIR"
pnpm build

echo -e "${GREEN}[4/4] Starting Electron Desktop App...${NC}"
cd "$DESKTOP_DIR"
pnpm start 2>&1 | sed "s/^/[DESKTOP] /" &
DESKTOP_PID=$!

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Development Environment Running${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Extension:${NC}      Building to browser-extension/dist/"
echo -e "${BLUE}Go Server:${NC}      http://127.0.0.1:51425"
echo -e "${BLUE}MCP Server:${NC}     Built (not running)"
echo -e "${BLUE}Desktop App:${NC}    Electron window should open"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all processes${NC}"
echo ""

# Wait for background processes
wait
