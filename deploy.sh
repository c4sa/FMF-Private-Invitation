#!/bin/bash

# Deployment script for React+Vite to Massar Cloud
echo "🚀 Starting deployment process..."

# Build the project
echo "📦 Building project for production..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Copy build files to public_html
    echo "📁 Copying files to public_html..."
    cp -r dist/* public_html/
    cp .htaccess public_html/
    
    echo "🎉 Deployment completed successfully!"
    echo "🌐 Your site should now be live at your domain"
else
    echo "❌ Build failed! Please check the errors above."
    exit 1
fi
