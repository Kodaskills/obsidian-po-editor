#!/bin/bash
# Hot Reload Script for Obsidian PO Editor
# Usage: ./dev.sh

cd "$(dirname "$0")"

# Watch for file changes and rebuild
echo "👀 Watching for changes..."
echo "📝 Edit main.ts and changes will auto-reload in Obsidian"
echo ""
echo "To activate in Obsidian:"
echo "1. Settings > Community plugins"
echo "2. Enable 'PO Editor' plugin"
echo "3. Toggle plugin off/on to reload"
echo ""

# Build on start
npm run build

# Watch for changes using fswatch or nodemon if available
if command -v fswatch &> /dev/null; then
    fswatch -o main.ts | while read f; do
        echo "🔄 Rebuilding..."
        npm run build
        echo "✅ Done! Reload plugin in Obsidian"
    done
elif command -v nodemon &> /dev/null; then
    nodemon --exec "npm run build" --watch "*.ts"
else
    # Fallback: simple watch with inotifywait
    echo "Installing fswatch for file watching..."
    if command -v brew &> /dev/null; then
        brew install fswatch
    fi
    
    inotifywait -m -e modify $(find . -name "*.ts" -not -path "./node_modules/*") 2>/dev/null | while read f; do
        echo "🔄 Rebuilding..."
        npm run build
        echo "✅ Done! Reload plugin in Obsidian"
    done
fi
