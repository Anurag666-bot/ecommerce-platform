#!/bin/bash
# Create a simple SVG fallback image
cat > public/sample-watch.jpg << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f0f0f0"/>
  <circle cx="200" cy="150" r="80" fill="#e0e0e0" stroke="#ccc" stroke-width="2"/>
  <circle cx="200" cy="150" r="70" fill="white" stroke="#ddd" stroke-width="1"/>
  <circle cx="200" cy="150" r="5" fill="#333"/>
  <!-- Hour markers -->
  <g stroke="#333" stroke-width="2">
    <line x1="200" y1="85" x2="200" y2="75"/>
    <line x1="280" y1="150" x2="270" y2="150"/>
    <line x1="200" y1="215" x2="200" y2="225"/>
    <line x1="120" y1="150" x2="130" y2="150"/>
  </g>
  <!-- Hands -->
  <line x1="200" y1="150" x2="200" y2="100" stroke="#333" stroke-width="3" stroke-linecap="round"/>
  <line x1="200" y1="150" x2="240" y2="120" stroke="#666" stroke-width="2" stroke-linecap="round"/>
  <text x="200" y="260" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">Sample Watch</text>
</svg>
SVGEOF

# Convert SVG to JPG using ImageMagick if available
if command -v convert &> /dev/null; then
  convert public/sample-watch.jpg public/sample-watch.jpg
  echo "✅ Created sample-watch.jpg"
else
  echo "✅ Created sample-watch.svg (rename to .jpg if needed)"
fi
