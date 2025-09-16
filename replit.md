# K-Loading Financial Management System

## Overview
K-Loading Financial is a comprehensive financial management application designed to provide budget management, transaction tracking, client reconciliation, and company information management with real-time updates. The system prioritizes multi-user isolation, ensuring data privacy while enabling real-time collaboration within user-specific boundaries. Its primary goal is to offer an intuitive, Excel-like experience for financial data management, streamlining operations and enhancing efficiency for businesses.

## User Preferences
- Preferred communication style: Simple, everyday language.
- Comprehensive setup documentation required for environment and project configuration.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter for client-side navigation.
- **State Management**: TanStack Query (React Query) for server state management.
- **UI Framework**: Radix UI primitives integrated with shadcn/ui components.
- **Styling**: Tailwind CSS with CSS variables for dynamic theming.
- **Build Tool**: Vite.
- **Layout**: Responsive design featuring a collapsible sidebar and Excel-like grids for data entry, emphasizing a clean, professional aesthetic with consistent styling, color-coded elements, and user-friendly navigation. Aims for a Google Sheets-like collaborative editing experience.

### Backend Architecture
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL with Drizzle ORM for robust relational data management.
- **Real-time Communication**: Dedicated WebSocket Server for live updates and collaborative functionalities.
- **Session Management**: JWT-based authentication with secure session handling.
- **API Design**: RESTful architecture with modular organization and centralized error handling.
- **Data Isolation**: All data access is secured with JWT authentication and strictly filtered by `user_id` to ensure complete user data privacy.
- **Hierarchical System**: Supports a multi-tier user hierarchy (Director, Manager, Employee) with role-based access control and shared data access for employees inheriting settings and data from directors.
- **Audit Trail**: Comprehensive logging system for all data modifications and user actions.
- **Database Restoration**: Successfully restored to original PostgreSQL/Drizzle setup from MongoDB migration attempt.

### Key Features & Technical Implementations
- **Budget Management**: Category-based allocation and tracking.
- **Account Management**: Excel-like grid with inline editing, real-time synchronization, and smart paste.
- **Client Reconciliation**: Approval workflows with shareable links.
- **Employee Management**: CRUD operations with role assignments and activity logging.
- **Activity Logs**: Real-time monitoring of employee actions and system changes with detailed value tracking.
- **Authentication**: JWT-based secure login with bcrypt hashing and permission-based page access.
- **Company Management**: Configuration of business information and settings.
- **Real-time Collaboration**: WebSocket-based live data updates, server-side batch grouping, client-side batch updates, cursor position tracking, typing indicators, and session management for collaborative editing. Includes automated full data refresh for consistency.
- **Data Integrity**: Mechanisms to prevent duplicate rows, phantom rows, and ensure data persistence during real-time operations.
- **Performance Optimization**: Chunked paste operations, optimized database queries, reduced redundant rendering, and efficient handling of large datasets.
- **UI Consistency**: Standardized ID formatting, consistent dropdowns linked to system settings, and optimized CSS.
- **Internal Package `@org/data-center`**: Centralized Vietnamese data normalization package including formatters, Zod validation schemas, and a DataCenter class for comprehensive data processing and validation.
- **Unified Autosave System**: Implemented an advanced, robust autosave framework with intelligent debouncing (800ms), batch processing with retry logic, real-time status indicators, and reusable architecture for all spreadsheet interfaces.
- **Smooth Editing Experience**: Enhanced spreadsheet editing with Excel-like cell behavior, displaying raw values during edit mode and formatted values for display, minimizing data refetches post-save to maintain focus.
- **Insertion Order Display**: Monthly visible accounts are displayed in insertion order, preserving the sequence of addition.
- **Handsontable Integration**: Extensive use of Handsontable for Excel-like interfaces in Account, Expense, Card, and Via Management, including filters, sorting, custom search, and optimized rendering.
- **Server-Side Handsontable Import**: Transitioned from CDN loading to server-side import for Handsontable, improving performance and reliability.
- **Deployment Module Resolution**: Comprehensive fixes for `@org/data-center` package module imports and monorepo support.
- **Database System**: Restored to original PostgreSQL/Drizzle ORM setup, resolving deployment build failures that occurred during partial MongoDB migration. System now runs on stable PostgreSQL foundation with Drizzle ORM as originally designed.
- **Performance Optimization (August 2025)**: Implemented comprehensive performance improvements for Handsontable Excel functionality, reducing GET data loading time from 3.08s to 0.16s (19x faster). Added database indexing, server-side query caching, and frontend optimization strategies.
- **Deployment Package**: Created complete VPS Windows deployment package with automated installation scripts, database setup, PM2 configuration, and comprehensive documentation for production deployment.
- **Permission System**: Supports hierarchical employee management with role-based access control, ensuring appropriate access to features like Via Management (create, read, update, delete permissions).
- **Threshold Management**: Advanced threshold monitoring system with automatic account detection based on status ("Ngưỡng", "DH", "Lỗi PTT"), manual TKQC addition functionality, and comprehensive management interface with proper ID/Name mapping.
- **Bank Order Management**: Complete workflow for creating bank orders from threshold data with filtering by Tag KH/Status/Month, requiring accounting and operations management approval before execution.
- **Tabbed Interface**: Integrated "QL Ngưỡng" (Threshold Management) and "Lệnh Bank" (Bank Orders) tabs with advanced filtering and approval workflows.

## External Dependencies

- **Database**: Neon Database (PostgreSQL provider)
- **ORM**: Drizzle ORM
- **UI Components**: Radix UI, shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Form Handling**: React Hook Form
- **Validation**: Zod
- **Date Utilities**: date-fns
- **Styling**: Tailwind CSS
- **Build Tools**: Vite (frontend), ESBuild (backend)
- **Real-time**: WebSocket Server
- **Authentication**: JWT, bcrypt
- **Number Formatting**: Intl.NumberFormat for Vietnamese Dong (VND)