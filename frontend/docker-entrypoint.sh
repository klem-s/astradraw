#!/bin/sh
# Docker entrypoint script for Excalidraw
# Creates a runtime environment config file that the app can read
# Supports Docker secrets via _FILE suffix (e.g., VITE_APP_WS_SERVER_URL_FILE)

set -e

# Directory containing the built files
APP_DIR="/usr/share/nginx/html"

# Function to get env var value, supporting _FILE suffix for Docker secrets
# Usage: get_secret "VAR_NAME" "default_value"
get_secret() {
    var_name="$1"
    default_value="${2:-}"
    
    # Check for _FILE variant first
    file_var="${var_name}_FILE"
    eval file_path="\$$file_var"
    
    if [ -n "$file_path" ] && [ -f "$file_path" ]; then
        # Read secret from file
        cat "$file_path"
        return
    fi
    
    # Fall back to regular env var
    eval value="\$$var_name"
    if [ -n "$value" ]; then
        echo "$value"
        return
    fi
    
    # Return default
    echo "$default_value"
}

# Get all environment values (supporting _FILE secrets)
WS_SERVER_URL=$(get_secret "VITE_APP_WS_SERVER_URL" "")
BACKEND_V2_GET_URL=$(get_secret "VITE_APP_BACKEND_V2_GET_URL" "")
BACKEND_V2_POST_URL=$(get_secret "VITE_APP_BACKEND_V2_POST_URL" "")
STORAGE_BACKEND=$(get_secret "VITE_APP_STORAGE_BACKEND" "")
HTTP_STORAGE_BACKEND_URL=$(get_secret "VITE_APP_HTTP_STORAGE_BACKEND_URL" "")
FIREBASE_CONFIG=$(get_secret "VITE_APP_FIREBASE_CONFIG" "{}")
DISABLE_TRACKING=$(get_secret "VITE_APP_DISABLE_TRACKING" "true")
GIPHY_API_KEY=$(get_secret "VITE_APP_GIPHY_API_KEY" "")
KINESCOPE_API_KEY=$(get_secret "VITE_APP_KINESCOPE_API_KEY" "")
KINESCOPE_PROJECT_ID=$(get_secret "VITE_APP_KINESCOPE_PROJECT_ID" "")

# Create a runtime config file with environment variables
# This is injected as a script in index.html
cat > "$APP_DIR/env-config.js" << ENVEOF
// Runtime environment configuration - generated at container startup
window.__ENV__ = {
  VITE_APP_WS_SERVER_URL: "${WS_SERVER_URL}",
  VITE_APP_BACKEND_V2_GET_URL: "${BACKEND_V2_GET_URL}",
  VITE_APP_BACKEND_V2_POST_URL: "${BACKEND_V2_POST_URL}",
  VITE_APP_STORAGE_BACKEND: "${STORAGE_BACKEND}",
  VITE_APP_HTTP_STORAGE_BACKEND_URL: "${HTTP_STORAGE_BACKEND_URL}",
  VITE_APP_FIREBASE_CONFIG: "${FIREBASE_CONFIG}",
  VITE_APP_DISABLE_TRACKING: "${DISABLE_TRACKING}",
  VITE_APP_GIPHY_API_KEY: "${GIPHY_API_KEY}",
  VITE_APP_KINESCOPE_API_KEY: "${KINESCOPE_API_KEY}",
  VITE_APP_KINESCOPE_PROJECT_ID: "${KINESCOPE_PROJECT_ID}"
};
ENVEOF

echo "Created runtime environment config at $APP_DIR/env-config.js"

# NOTE: Script tag injection is no longer needed - it's now in index.html source
# This code is commented out for testing. Remove completely if everything works.
# --- BEGIN COMMENTED OUT ---
# # Inject the env-config.js script into index.html if not already present
# if ! grep -q "env-config.js" "$APP_DIR/index.html"; then
#     # Insert the script tag right after the opening <head> tag
#     sed -i 's|<head>|<head><script src="/env-config.js"></script>|' "$APP_DIR/index.html"
#     echo "Injected env-config.js into index.html"
# fi
# --- END COMMENTED OUT ---

echo "Environment configuration complete."

# ============================================================================
# Pre-bundled Libraries Processing
# Scans /app/libraries/*.excalidrawlib files and generates bundled-libraries.js
# ============================================================================

LIBRARIES_DIR="/app/libraries"
BUNDLED_LIBS_FILE="$APP_DIR/bundled-libraries.js"

# Function to humanize a filename (e.g., "software-architecture" -> "Software Architecture")
humanize_filename() {
    echo "$1" | sed 's/-/ /g; s/_/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1'
}

# Function to extract the "name" field from JSON if present
extract_library_name() {
    local file="$1"
    local fallback="$2"
    # Try to extract "name" field from JSON root level
    # Using grep and sed for compatibility with Alpine/busybox
    local name=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$file" | head -1 | sed 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    if [ -n "$name" ]; then
        echo "$name"
    else
        echo "$fallback"
    fi
}

# Function to extract the "names" object (localized names) from JSON if present
# Returns the JSON object as-is for embedding, or empty string if not found
extract_library_names() {
    local file="$1"
    # Extract "names" object from JSON root level using awk
    # This handles nested objects properly by counting braces
    awk '
    BEGIN { in_names = 0; brace_count = 0; buffer = "" }
    {
        if (!in_names && match($0, /"names"[[:space:]]*:[[:space:]]*\{/)) {
            in_names = 1
            # Get everything starting from the opening brace
            sub(/.*"names"[[:space:]]*:[[:space:]]*/, "")
            brace_count = 0
        }
        if (in_names) {
            for (i = 1; i <= length($0); i++) {
                c = substr($0, i, 1)
                buffer = buffer c
                if (c == "{") brace_count++
                if (c == "}") {
                    brace_count--
                    if (brace_count == 0) {
                        # Complete object found
                        print buffer
                        exit
                    }
                }
            }
            buffer = buffer "\n"
        }
    }
    ' "$file" | tr -d '\n'
}

# Function to process .excalidrawlib files and extract library items
process_libraries() {
    local first=true
    
    # Start the JavaScript file
    echo "// Pre-bundled libraries - generated at container startup" > "$BUNDLED_LIBS_FILE"
    echo "window.__BUNDLED_LIBRARIES__ = [" >> "$BUNDLED_LIBS_FILE"
    
    # Check if libraries directory exists and has files
    if [ -d "$LIBRARIES_DIR" ]; then
        for libfile in "$LIBRARIES_DIR"/*.excalidrawlib; do
            # Check if file exists (glob might not match anything)
            [ -e "$libfile" ] || continue
            
            echo "Processing library: $libfile"
            
            # Extract the library array from the .excalidrawlib file
            # The file format is: { "type": "excalidrawlib", "version": N, "library": [...] }
            # or older format with "libraryItems" instead of "library"
            
            # Use sed/awk to extract library items and add required fields
            # Each item needs: id, status, created, elements, name (optional), libraryName
            
            if [ "$first" = true ]; then
                first=false
            else
                echo "," >> "$BUNDLED_LIBS_FILE"
            fi
            
            # Parse the JSON and extract library items
            # Using a simple approach that works with busybox tools in Alpine
            # Extract the "library" or "libraryItems" array content
            
            # Get filename without path and extension for naming
            libname=$(basename "$libfile" .excalidrawlib)
            
            # Get humanized fallback name from filename
            humanized_name=$(humanize_filename "$libname")
            
            # Extract library display name from JSON "name" field, or use humanized filename
            library_display_name=$(extract_library_name "$libfile" "$humanized_name")
            
            # Extract localized names object if present
            library_names_json=$(extract_library_names "$libfile")
            
            echo "  Library display name: $library_display_name"
            if [ -n "$library_names_json" ]; then
                echo "  Localized names found: $library_names_json"
            fi
            
            # Process the library file - extract items and add metadata
            # This awk script extracts items from the library array
            awk -v libname="$libname" '
            BEGIN { 
                in_library = 0
                bracket_count = 0
                item_count = 0
                buffer = ""
            }
            {
                line = $0
                
                # Look for start of library array
                if (match(line, /"library"\s*:\s*\[/) || match(line, /"libraryItems"\s*:\s*\[/)) {
                    in_library = 1
                    # Get everything after the opening bracket
                    sub(/.*"library"\s*:\s*\[/, "", line)
                    sub(/.*"libraryItems"\s*:\s*\[/, "", line)
                }
                
                if (in_library) {
                    # Count brackets to track nested arrays
                    for (i = 1; i <= length(line); i++) {
                        c = substr(line, i, 1)
                        if (c == "[") bracket_count++
                        if (c == "]") {
                            bracket_count--
                            if (bracket_count < 0) {
                                # End of library array - remove trailing ]
                                sub(/\].*$/, "", line)
                                in_library = 0
                            }
                        }
                    }
                    buffer = buffer line "\n"
                }
            }
            END {
                # Output the extracted library items with wrapper
                # Each item is an array of elements, we need to wrap it as a LibraryItem
                print buffer
            }
            ' "$libfile" | \
            # Now process each item (array of elements) and wrap it
            awk -v libname="$libname" -v libraryDisplayName="$library_display_name" -v libraryNamesJson="$library_names_json" '
            BEGIN {
                item_num = 0
                in_item = 0
                bracket_count = 0
                item_buffer = ""
                first_item = 1
                has_localized_names = (length(libraryNamesJson) > 0)
            }
            {
                line = $0
                for (i = 1; i <= length(line); i++) {
                    c = substr(line, i, 1)
                    
                    if (c == "[" && !in_item) {
                        in_item = 1
                        bracket_count = 1
                        item_buffer = "["
                    } else if (in_item) {
                        item_buffer = item_buffer c
                        if (c == "[") bracket_count++
                        if (c == "]") {
                            bracket_count--
                            if (bracket_count == 0) {
                                # Complete item found
                                item_num++
                                if (first_item) {
                                    first_item = 0
                                } else {
                                    printf ","
                                }
                                # Generate unique ID based on library name and item number
                                id = libname "-" item_num
                                timestamp = systime() * 1000
                                printf "{\n"
                                printf "  \"id\": \"%s\",\n", id
                                printf "  \"status\": \"published\",\n"
                                printf "  \"created\": %d,\n", timestamp
                                printf "  \"name\": \"%s Item %d\",\n", libname, item_num
                                printf "  \"libraryName\": \"%s\",\n", libraryDisplayName
                                if (has_localized_names) {
                                    printf "  \"libraryNames\": %s,\n", libraryNamesJson
                                }
                                printf "  \"elements\": %s\n", item_buffer
                                printf "}"
                                in_item = 0
                                item_buffer = ""
                            }
                        }
                    }
                }
            }
            ' >> "$BUNDLED_LIBS_FILE"
            
        done
    fi
    
    # Close the JavaScript array
    echo "" >> "$BUNDLED_LIBS_FILE"
    echo "];" >> "$BUNDLED_LIBS_FILE"
    
    echo "Generated bundled libraries at $BUNDLED_LIBS_FILE"
}

# Process libraries
process_libraries

# Inject the bundled-libraries.js script into index.html if not already present
if ! grep -q "bundled-libraries.js" "$APP_DIR/index.html"; then
    # Insert the script tag right after env-config.js
    sed -i 's|<script src="/env-config.js"></script>|<script src="/env-config.js"></script><script src="/bundled-libraries.js"></script>|' "$APP_DIR/index.html"
    echo "Injected bundled-libraries.js into index.html"
fi

echo "Library configuration complete."

# Execute the original entrypoint (nginx)
exec "$@"
