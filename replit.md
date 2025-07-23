# Restaurant Management System

## Overview
A comprehensive restaurant management system built with Node.js, Express, React, and PostgreSQL. Features include inventory management, purchase orders, user management, audit logging, and QR code generation for tables.

## Project Architecture
- **Frontend**: React with Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js server with PostgreSQL database
- **Database**: Drizzle ORM with PostgreSQL
- **Authentication**: Passport.js with local strategy
- **Real-time**: WebSocket and SSE support
- **Security**: CSRF protection, rate limiting, helmet

## Key Features
- User management with role-based access
- Inventory tracking with low stock alerts
- Purchase order management
- Audit logging for all actions
- QR code generation for restaurant tables
- Real-time notifications
- File upload capabilities

## Recent Changes
- **2025-07-23**: Successfully completed migration from Replit Agent to Replit environment
- **Migration Status**: Complete - PostgreSQL database configured, all systems operational
- **Order Deletion Bug Fixed**: Critical issue resolved where deleting items from orders couldn't be saved
  - Problem: System only handled adding new items or increasing quantities, not deletions
  - Solution: Created new PUT endpoint `/api/restaurant/orders/:id` for complete order updates
  - Frontend now sends entire order state for updates instead of just new items
  - Backend uses `replaceOrderItems()` to handle all modifications including deletions
  - Users can now successfully delete items from orders and save changes
- **DateTime Conversion Fix**: Fixed critical reservation datetime handling issue across all environments
  - Problem: User enters 7:30 AM but system saves different time due to timezone conversion
  - Root cause: Different server timezones (Replit=UTC, local dev=varies) caused inconsistent behavior
  - Solution: Implemented UTC constructor method that treats all user input as UTC time
  - Applied to both reservation creation and editing workflows
  - Backend now preserves exact datetime input (7:30 AM stays 7:30 AM) in any environment
  - Uses Date.UTC() constructor to completely bypass timezone interpretation
  - Added detailed logging to track datetime conversions for debugging
  - Bulletproof approach that works identically regardless of server timezone
- **Previous Fixes Maintained**:
  - Order System: Single bill per table until checkout
  - Bill Printing: Complete item details display
  - Table Reset: Proper cleanup after checkout
  - DateTime Input: Proper formatting for edit mode

## User Preferences
- Language: English
- Communication: Simple, everyday language
- Focus: Robust security practices and client/server separation

## Database Schema
Located in `shared/schema.ts` with tables for:
- Users, roles, permissions
- Restaurants, tables, rooms
- Inventory items, purchase orders
- Audit logs and notifications
- Dish ingredients and measuring units

## Environment Requirements
- PostgreSQL database
- Node.js with Express server
- Vite development server for frontend