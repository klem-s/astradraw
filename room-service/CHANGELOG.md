# Changelog

All notable changes to AstraDraw Room (WebSocket Server) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-25

### Added

**Real-time Collaboration**

- WebSocket server for real-time scene collaboration
- Presence indicators for connected users
- Cursor position broadcasting
- Scene element synchronization

**Comment System**

- Real-time comment event relay
- Support for thread creation, resolution, deletion
- Support for comment add, update, delete events
- Broadcast to all room participants except sender

**Infrastructure**

- Increased `maxHttpBufferSize` to 200MB for large file transfers
- Multi-platform Docker builds (amd64, arm64)
- PM2 support for production clustering

### Based On

This server is forked from [excalidraw-room](https://github.com/excalidraw/excalidraw-room).

**Original License:** MIT License © 2020 Excalidraw
