#!/bin/bash

echo "Starting GeoMusica OSC Bridge Server..."
echo ""
echo "This server bridges WebSocket (browser) and OSC (external apps)"
echo ""
echo "Configuration:"
echo "- WebSocket OSC IN:  localhost:8080  (browser receives)"
echo "- WebSocket OSC OUT: localhost:8081  (browser sends)"
echo "- OSC IN UDP:        localhost:13245 (external apps send)"
echo "- OSC OUT UDP:       localhost:53421 (external apps receive)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start 