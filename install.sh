#!/bin/bash
set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  P31 Sovereign CLI \u2014 Installation${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}\u2717 Node.js not found. Please install Node.js 22+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo -e "${RED}\u2717 Node.js version 22+ required (found v$NODE_VERSION)${NC}"
    exit 1
fi

echo -e "${GREEN}\u2713 Node.js v$NODE_VERSION found${NC}"

echo -e "${CYAN}\uD83D\uDCE6 Installing @p31/cli...${NC}"

if npm install -g @p31/cli 2>/dev/null; then
    echo -e "${GREEN}\u2713 Installation successful!${NC}"
else
    echo -e "${YELLOW}npm registry install failed. Attempting local build...${NC}"
    if [ -d "$(dirname "$0")" ]; then
        cd "$(dirname "$0")"
        npm install && npm run build && npm link
        echo -e "${GREEN}\u2713 Local build successful!${NC}"
    else
        echo -e "${RED}\u2717 Installation failed.${NC}"
        echo -e "${YELLOW}Try: git clone https://github.com/p31labs/p31-cli && cd p31-cli && npm install && npm run build && npm link${NC}"
        exit 1
    fi
fi

if command -v p31 &> /dev/null; then
    echo -e ""
    echo -e "${CYAN}\u{1F680} Quick start:${NC}"
    echo -e "  ${YELLOW}p31 chat${NC}        # Start interactive chat"
    echo -e "  ${YELLOW}p31 agent <task>${NC}  # Run autonomous agent"
    echo -e "  ${YELLOW}p31 stream${NC}       # Stream terminal via WebSocket"
    echo -e "  ${YELLOW}p31 ui${NC}          # Open web interface"
    echo -e "  ${YELLOW}p31 spoons${NC}       # Set spoon level"
    echo -e ""
    echo -e "${CYAN}\u{1F4D6} Documentation: https://cli.p31ca.org/docs${NC}"
else
    echo -e "${RED}\u2717 Installation failed. Please check npm permissions.${NC}"
    exit 1
fi
