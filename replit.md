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
- **2025-07-24**: Successfully completed migration from Replit Agent to Replit environment
- **Migration Status**: Complete - PostgreSQL database configured, all systems operational
- **Room Orders Summary Fixed**: Resolved issue where only latest order items were visible
  - Now shows ALL order items from ALL orders for each reservation
  - Previous and new order items displayed together in unified table
  - Visual distinction with blue highlighting for new items being added
  - Comprehensive billing showing previous orders + new orders + grand total
  - Full CRUD operations available for all items from any order
- **Room Service Orders System Complete Overhaul**: Fixed all critical issues with comprehensive solution
  - Problem: Could only see latest order items, couldn't edit previous order items
  - Solution: Implemented full CRUD operations for ALL orders in a reservation
  - Shows ALL dishes from ALL orders for each reservation in table format
  - Previous order items and new items displayed together without distinction tags
  - Full edit controls: add/remove/modify quantities for any item from any order
  - Real-time billing updates combining all orders for accurate totals
  - Table-style layout matching restaurant table orders interface
  - Users can now manage complete order history for each reservation
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