# WebAssembly Setup for Geomusica

## Prerequisites
1. Download Rust Installer: https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe
2. Run the installer and follow the default installation

## Install WebAssembly Toolchain
```powershell
# Install wasm-pack
cargo install wasm-pack

# Verify installation
wasm-pack --version
```

## Project Setup
```powershell
# Navigate to project directory
cd c:\Users\Rui\geomusica-web

# Install wasm-bindgen-cli for additional tooling
cargo install wasm-bindgen-cli

# Build WebAssembly package
cd src/geometry
wasm-pack build --target web

# Return to project root
cd ../..

# Move generated files to appropriate directory
Move-Item -Path src/geometry/pkg/* -Destination src/geometry/
```

## Troubleshooting
- Ensure you're in the correct directory
- Check Cargo.toml configuration
- Verify Rust and wasm-pack installation

## Webpack/Bundler Configuration
If using a bundler, update your webpack config or import strategy:
```javascript
import init, { find_intersection } from './src/geometry/geomusica_wasm.js';

async function initWasm() {
    await init();
    // Now you can use WebAssembly functions
}
```

## Troubleshooting
- Ensure Rust is in system PATH
- Restart terminal after installation
- Check https://rustwasm.github.io/wasm-pack/ for detailed instructions
