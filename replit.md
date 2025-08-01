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
- **2025-08-01**: Successfully completed migration from Replit Agent to Replit environment  
- **Migration Status**: Complete - PostgreSQL database configured, all systems operational
- **Default BORE Printer Configuration**: Configured default KOT printer with BORE cloud system
  - Host/IP: bore.pub, Port: 32384, Protocol: Raw TCP/Socket
  - Automatic direct printing enabled for KOT orders
  - Ready for cloud-to-local thermal printer communication
- **BORE Printer Integration**: Successfully configured cloud-based printer system via BORE tunnel
  - Configured KOT and BOT printers with bore.pub:32384 for cloud-to-local printing
  - Automatic printing enabled for both table orders and room orders
  - Connection tested and verified working with BORE tunnel setup
  - Raw TCP/Socket protocol established for thermal printer communication
- **Inventory Enhancement**: Added pagination and search functionality to all inventory pages
  - Implemented consistent pagination controls across stock items, categories, suppliers, and purchase orders
  - Added search functionality with customizable search fields for each inventory module
  - Enhanced user experience with proper loading states and responsive design
  - Fixed TypeScript errors and improved type safety across inventory components
- **Diet Column Display Logic**: Fixed display logic for Bar type dishes
  - Problem: Diet column showing "VEG" for Bar category dishes instead of "-" dash
  - Root cause: Backend API missing menuType field in category data, causing frontend logic to fail
  - Solution: Added menuType field to restaurant-storage.ts getMenuDishes category selection
  - Diet column now shows "-" dash for Bar category dishes as intended
  - VEG/NON-VEG/VEGAN indicators only display for Food category dishes
  - Maintains clean interface by hiding irrelevant diet data for beverages and bar items
- **PWA Rotation Support Fixed**: Enhanced mobile and tablet rotation support for restaurant management system
  - Fixed PWA manifest orientation from "portrait-primary" to "any" to allow free rotation
  - Updated viewport meta tag to enable user scaling and improved touch interaction
  - Added comprehensive CSS support for orientation changes (landscape/portrait)
  - Added responsive layout improvements for mobile/tablet rotation scenarios
  - Enhanced touch targets for mobile devices with minimum 44px touch areas
  - Fixed JSX syntax errors that were preventing application startup
- **KOT/BOT Generation System Enhanced**: Improved reservation-based KOT/BOT processing
  - Created new endpoint for processing all orders in a reservation simultaneously
  - Added comprehensive error handling and user feedback for order generation
  - Enhanced button logic to work with reservation IDs instead of individual order IDs
  - Added clear messaging when no orders exist to generate tickets from
  - Created test data structure: guest, reservation, and menu items for testing functionality
- **Timezone Fix for Room Orders**: Fixed critical timezone issue affecting room order timestamps
  - Problem: Room order creation times displayed in UTC instead of hotel's configured timezone
  - Root cause: Frontend using server UTC timestamps without timezone conversion
  - Solution: Implemented timezone-aware timestamp display using hotel settings configuration
  - Added formatDateInTimezone utility function for proper timezone conversion
  - Order timestamps now display correctly in hotel's configured timezone (Asia/Kathmandu by default)
  - Fixed both reservation card timestamps and individual order detail timestamps
  - Users now see accurate local time when room orders are created
- **Printer Configuration Bug Fix**: Fixed critical printer configuration saving issue
  - Problem: Printer configurations not saving due to API request format errors and schema mismatches
  - Root cause: Frontend using incorrect apiRequest parameters and uppercase printer types
  - Solution: Updated API calls to use correct format (method, url, data) and lowercase printer types
  - Fixed TypeScript errors and added automatic branchId handling
  - Printer configuration form now properly validates and saves to database
- **Printer Configuration System**: Implementing comprehensive KOT/BOT printer configuration with IP addresses
  - Added printer service for thermal printer communication via TCP/IP
  - Network connectivity testing and error handling
  - Automatic printing when Direct KOT/BOT print toggle is enabled
  - Support for KOT (Kitchen Order Ticket) and BOT (Beverage Order Ticket) printers
  - Configurable IP addresses, ports, and connection settings per branch
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
- **Automatic KOT/BOT Printing System Implemented**: Fully integrated automatic printing with comprehensive printer configuration
  - Complete KOT/BOT printer configuration system with TCP/IP network support
  - **Automatic Printing**: KOT items automatically print to KOT printers, BOT items to BOT printers
  - No manual printing required - system auto-sends tickets when orders are generated
  - Real-time printer status monitoring and error handling during auto-print attempts
  - Detailed logging with success/failure tracking for each print job
  - Database updates for print timestamps and printer connection status
  - User-friendly settings interface with dedicated "Printers" tab
  - Support for multiple printer types: KOT, BOT, and billing printers
  - Configurable IP addresses, ports, timeouts, and retry settings
  - Works without requiring physical printers for configuration storage
- **DateTime Conversion Fix**: Fixed critical reservation datetime handling issue across all environments
  - Problem: User enters 7:30 AM but system saves different time due to timezone conversion
  - Root cause: Different server timezones (Replit=UTC, local dev=varies) caused inconsistent behavior
  - Solution: Implemented UTC constructor method that treats all user input as UTC time
  - Applied to both reservation creation and editing workflows
  - Backend now preserves exact datetime input (7:30 AM stays 7:30 AM) in any environment
  - Uses Date.UTC() constructor to completely bypass timezone interpretation
  - Added detailed logging to track datetime conversions for debugging
  - Bulletproof approach that works identically regardless of server timezone
- **Room Orders Display Fix**: Fixed reservation cards showing only latest order total instead of cumulative total
  - Problem: Reservation cards showed "Rs. 120.00, 1 items" for individual orders, not total for all orders
  - Root cause: Frontend only displayed details from single order instead of calculating totals across all reservation orders
  - Solution: Updated reservation card logic to calculate cumulative totals for ALL orders per reservation
  - Now shows proper total amount and item count across multiple orders for each reservation
  - Enhanced display to show order count when multiple orders exist (e.g., "3 Orders (Latest: #RM58202979)")
  - Fixed both server-side dish name flattening and frontend cumulative calculations
- **Deferred Update System Implementation**: Optimized Order Summary efficiency with batch updates
  - Problem: Every quantity change triggered immediate API calls, causing server load and poor UX
  - Root cause: Direct database updates on each +/- button click led to excessive API requests
  - Solution: Implemented deferred update system with local staging and explicit commit actions
  - Changes are staged locally with visual feedback showing pending modifications
  - Users see orange notification banner with unsaved change count
  - "Update Orders" button applies all changes in single batch API call
  - "Discard" button resets all pending changes without database impact
  - Significant performance improvement and reduced server load
  - Better user control over when changes are actually committed
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