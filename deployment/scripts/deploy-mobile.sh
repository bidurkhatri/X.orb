#!/bin/bash

# Mobile App Deployment Script for SylOS
# Description: Builds and deploys mobile applications for iOS and Android

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default values
ENVIRONMENT="development"
USE_TESTNET=false
SKIP_BUILD=false
DRY_RUN=false
BUILD_IOS=true
BUILD_ANDROID=true
BUILD_APK=true
BUILD_IPA=true
PUBLISH_APP_STORE=false
PUBLISH_PLAY_STORE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--testnet)
            USE_TESTNET=true
            shift
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-ios)
            BUILD_IOS=false
            shift
            ;;
        --no-android)
            BUILD_ANDROID=false
            shift
            ;;
        --no-apk)
            BUILD_APK=false
            shift
            ;;
        --no-ipa)
            BUILD_IPA=false
            shift
            ;;
        --app-store)
            PUBLISH_APP_STORE=true
            shift
            ;;
        --play-store)
            PUBLISH_PLAY_STORE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Build and deploy mobile applications"
            echo ""
            echo "Options:"
            echo "  -e, --env ENV       Environment (development|staging|production)"
            echo "  -t, --testnet       Use testnet instead of mainnet"
            echo "  -s, --skip-build    Skip build steps"
            echo "  --dry-run          Show what would be built without building"
            echo "  --no-ios           Skip iOS build"
            echo "  --no-android       Skip Android build"
            echo "  --no-apk           Skip APK build"
            echo "  --no-ipa           Skip IPA build"
            echo "  --app-store        Publish to App Store (requires certificates)"
            echo "  --play-store       Publish to Google Play (requires certificates)"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Load environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../environments/${ENVIRONMENT}.env"

if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

# Configuration
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
MOBILE_DIR="$ROOT_DIR/sylos-mobile-new"
DEPLOYMENT_DIR="$SCRIPT_DIR/../deployment"
BUILD_OUTPUT="$DEPLOYMENT_DIR/mobile-builds"
LOG_FILE="$DEPLOYMENT_DIR/logs/mobile-deployment-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).log"

# Create necessary directories
mkdir -p "$BUILD_OUTPUT"
mkdir -p "$DEPLOYMENT_DIR/logs"
mkdir -p "$DEPLOYMENT_DIR/mobile-artifacts"

# Function to check Expo CLI
check_expo_cli() {
    if command -v expo &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to install dependencies
install_dependencies() {
    log_info "Installing mobile app dependencies..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would install dependencies in $MOBILE_DIR"
        return 0
    fi
    
    cd "$MOBILE_DIR"
    
    if command -v pnpm &> /dev/null; then
        pnpm install
    elif command -v npm &> /dev/null; then
        npm install
    else
        log_error "No package manager found"
        exit 1
    fi
    
    # Install Expo CLI globally if not present
    if ! check_expo_cli; then
        log_info "Installing Expo CLI..."
        npm install -g @expo/cli
    fi
}

# Function to update app configuration
update_app_config() {
    log_info "Updating app configuration for $ENVIRONMENT environment..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update app configuration"
        return 0
    fi
    
    # Update app.json
    if [ -f "$MOBILE_DIR/app.json" ]; then
        local app_config="$MOBILE_DIR/app.json"
        local temp_config="/tmp/app.json.$$"
        
        # Create a temporary updated config
        cat > "$temp_config" << EOF
{
  "expo": {
    "name": "$MOBILE_APP_NAME",
    "slug": "sylos-${ENVIRONMENT}",
    "version": "$MOBILE_VERSION",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "$MOBILE_BUNDLE_ID"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "package": "$MOBILE_BUNDLE_ID"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      },
      "env": "$ENVIRONMENT",
      "network": "$NETWORK_NAME",
      "testnet": $USE_TESTNET
    }
  }
}
EOF
        mv "$temp_config" "$app_config"
    fi
    
    # Update app.config.js if it exists
    if [ -f "$MOBILE_DIR/app.config.js" ]; then
        cat > "$MOBILE_DIR/app.config.js" << EOF
export default {
  expo: {
    name: '$MOBILE_APP_NAME',
    slug: 'sylos-$ENVIRONMENT',
    version: '$MOBILE_VERSION',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: '$MOBILE_BUNDLE_ID'
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF'
      },
      package: '$MOBILE_BUNDLE_ID'
    },
    web: {
      favicon: './assets/favicon.png'
    },
    extra: {
      eas: {
        projectId: 'your-eas-project-id'
      },
      env: '$ENVIRONMENT',
      network: '$NETWORK_NAME',
      testnet: $USE_TESTNET,
      rpcUrl: '$RPC_URL',
      chainId: $CHAIN_ID,
      explorerUrl: '$EXPLORER_URL',
      frontendUrl: '$FRONTEND_URL',
      apiUrl: '$API_URL',
      ipfsGateway: '$IPFS_GATEWAY'
    }
  }
};
EOF
    fi
}

# Function to build for web (preview)
build_web() {
    log_info "Building mobile app for web..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would build web version"
        return 0
    fi
    
    cd "$MOBILE_DIR"
    expo export --platform web
}

# Function to build for Android
build_android() {
    if [ "$BUILD_ANDROID" = true ]; then
        log_info "Building Android application..."
        
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY RUN] Would build Android APK"
            return 0
        fi
        
        cd "$MOBILE_DIR"
        
        # Build APK for development
        if [ "$BUILD_APK" = true ]; then
            log_info "Building APK..."
            expo export --platform android --type apk
            
            # Copy APK to output directory
            if [ -f "$MOBILE_DIR/dist/*" ]; then
                cp "$MOBILE_DIR/dist/"*.apk "$BUILD_OUTPUT/" 2>/dev/null || true
            fi
        fi
        
        # Build AAB for store submission
        if [ "$ENVIRONMENT" = "production" ]; then
            log_info "Building AAB for Google Play..."
            expo export --platform android --type aab
            
            # Copy AAB to output directory
            if [ -f "$MOBILE_DIR/dist/"*.aab ]; then
                cp "$MOBILE_DIR/dist/"*.aab "$BUILD_OUTPUT/"
            fi
        fi
    fi
}

# Function to build for iOS
build_ios() {
    if [ "$BUILD_IOS" = true ]; then
        log_info "Building iOS application..."
        
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY RUN] Would build iOS app"
            return 0
        fi
        
        cd "$MOBILE_DIR"
        
        # Build IPA for development
        if [ "$BUILD_IPA" = true ]; then
            log_info "Building IPA..."
            expo export --platform ios --type archive
            
            # Copy IPA to output directory
            if [ -f "$MOBILE_DIR/dist/"*.ipa ]; then
                cp "$MOBILE_DIR/dist/"*.ipa "$BUILD_OUTPUT/"
            fi
        fi
        
        # Build App Store version
        if [ "$ENVIRONMENT" = "production" ]; then
            log_info "Building for App Store..."
            expo export --platform ios --type archive
        fi
    fi
}

# Function to run tests
run_tests() {
    log_info "Running mobile app tests..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run mobile tests"
        return 0
    fi
    
    cd "$MOBILE_DIR"
    
    # Run linting
    if [ -f "package.json" ] && grep -q "\"lint\"" package.json; then
        log_info "Running ESLint..."
        npm run lint
    fi
    
    # Run type checking
    if [ -f "package.json" ] && grep -q "\"type-check\"" package.json; then
        log_info "Running type check..."
        npm run type-check
    fi
}

# Function to create app icons and splash screens
create_app_assets() {
    log_info "Creating app assets..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would create app assets"
        return 0
    fi
    
    # This would use a script to generate icons and splash screens
    # For now, we'll copy from existing assets or create placeholders
    
    local assets_dir="$MOBILE_DIR/assets"
    mkdir -p "$assets_dir"
    
    # Create placeholder icon if it doesn't exist
    if [ ! -f "$assets_dir/icon.png" ]; then
        log_warning "Icon not found, creating placeholder..."
        # In a real deployment, you would generate or copy the actual icon
        touch "$assets_dir/icon.png"
    fi
    
    # Create placeholder splash screen if it doesn't exist
    if [ ! -f "$assets_dir/splash.png" ]; then
        log_warning "Splash screen not found, creating placeholder..."
        # In a real deployment, you would generate or copy the actual splash screen
        touch "$assets_dir/splash.png"
    fi
}

# Function to publish to app stores
publish_app_store() {
    if [ "$PUBLISH_APP_STORE" = true ]; then
        log_info "Publishing to Apple App Store..."
        
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY RUN] Would publish to App Store"
            return 0
        fi
        
        # This would use fastlane or expo publish
        # expo publish --platform ios
        log_info "App Store publishing would happen here"
    fi
}

# Function to publish to Google Play
publish_play_store() {
    if [ "$PUBLISH_PLAY_STORE" = true ]; then
        log_info "Publishing to Google Play Store..."
        
        if [ "$DRY_RUN" = true ]; then
            log_info "[DRY RUN] Would publish to Google Play Store"
            return 0
        fi
        
        # This would use fastlane or expo publish
        # expo publish --platform android
        log_info "Google Play Store publishing would happen here"
    fi
}

# Function to create build info
create_build_info() {
    local build_info_file="$DEPLOYMENT_DIR/mobile-artifacts/build-info-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).json"
    
    log_info "Creating build info: $build_info_file"
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would create build info"
        return 0
    fi
    
    cat > "$build_info_file" << EOF
{
  "build": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "$ENVIRONMENT",
    "network": "$NETWORK_NAME",
    "testnet": $USE_TESTNET
  },
  "app": {
    "name": "$MOBILE_APP_NAME",
    "bundleId": "$MOBILE_BUNDLE_ID",
    "version": "$MOBILE_VERSION"
  },
  "builds": {
    "ios": $BUILD_IOS,
    "android": $BUILD_ANDROID,
    "web": true
  },
  "outputs": {
    "apk": $BUILD_APK,
    "ipa": $BUILD_IPA
  },
  "publishing": {
    "app_store": $PUBLISH_APP_STORE,
    "play_store": $PUBLISH_PLAY_STORE
  }
}
EOF
}

# Function to generate deployment report
generate_deployment_report() {
    local report_file="$DEPLOYMENT_DIR/logs/mobile-deployment-report-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).md"
    
    log_info "Generating deployment report: $report_file"
    
    cat > "$report_file" << EOF
# Mobile App Deployment Report

**Date:** $(date)
**Environment:** $ENVIRONMENT
**Network:** $NETWORK_NAME
**Testnet Mode:** $USE_TESTNET

## Build Configuration

| Platform | Status | Output |
|----------|--------|--------|
EOF

    if [ "$BUILD_IOS" = true ]; then
        echo "| iOS | ✅ | IPA/Archive |" >> "$report_file"
    else
        echo "| iOS | ❌ | Skipped |" >> "$report_file"
    fi
    
    if [ "$BUILD_ANDROID" = true ]; then
        echo "| Android | ✅ | APK/AAB |" >> "$report_file"
    else
        echo "| Android | ❌ | Skipped |" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

## App Information

- **App Name:** $MOBILE_APP_NAME
- **Bundle ID:** $MOBILE_BUNDLE_ID
- **Version:** $MOBILE_VERSION
- **Build Environment:** $BUILD_ENV

## Network Configuration

- **Network:** $NETWORK_NAME
- **Chain ID:** $CHAIN_ID
- **RPC URL:** $RPC_URL
- **Explorer:** $EXPLORER_URL

## Build Artifacts

Build artifacts are available in: $BUILD_OUTPUT

## Next Steps

EOF

    if [ "$PUBLISH_APP_STORE" = true ]; then
        echo "1. Submit iOS build to App Store Connect" >> "$report_file"
    fi
    
    if [ "$PUBLISH_PLAY_STORE" = true ]; then
        echo "2. Submit Android build to Google Play Console" >> "$report_file"
    fi

    cat >> "$report_file" << EOF

3. Test app functionality on devices
4. Monitor app performance and crashes
5. Update app store listings if needed

EOF
}

# Main deployment function
main() {
    log_info "Starting mobile app deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Testnet: $USE_TESTNET"
    log_info "Build iOS: $BUILD_IOS"
    log_info "Build Android: $BUILD_ANDROID"
    
    if [ "$DRY_RUN" = true ]; then
        log_warning "Running in DRY RUN mode - no actual build will occur"
    fi
    
    # Check prerequisites
    if [ -d "$MOBILE_DIR" ]; then
        log_info "Mobile project found: $MOBILE_DIR"
    else
        log_error "Mobile project not found: $MOBILE_DIR"
        exit 1
    fi
    
    # Create assets
    create_app_assets
    
    # Update configuration
    update_app_config
    
    if [ "$SKIP_BUILD" = false ]; then
        # Install dependencies
        install_dependencies
        
        # Build for all platforms
        build_web
        build_android
        build_ios
        
        # Run tests
        run_tests
    fi
    
    # Create build info
    create_build_info
    
    # Publish to stores
    if [ "$ENVIRONMENT" = "production" ]; then
        publish_app_store
        publish_play_store
    fi
    
    # Generate report
    generate_deployment_report
    
    log_success "Mobile app deployment completed!"
    log_info "Build artifacts: $BUILD_OUTPUT"
    log_info "Build info: $DEPLOYMENT_DIR/mobile-artifacts/"
    log_info "Deployment logs: $DEPLOYMENT_DIR/logs"
}

# Run main function
main "$@"