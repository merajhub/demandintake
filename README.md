# Demand Intake Process Tracker

A full-stack web application for managing project demand intake workflows.

## Tech Stack
- **Frontend**: Angular 17 + Angular Material
- **Backend**: Node.js + Express + TypeScript
- **Database**: MySQL 8 + Sequelize ORM

## Prerequisites
- Node.js 18+
- MySQL 8.0+

## Quick Start

### 1. Database Setup
```bash
# Create the database and tables
mysql -u root -p < backend/database/schema.sql

# Seed demo data
mysql -u root -p < backend/database/seed.sql
```

### 2. Backend
```bash
cd backend
npm install
# Edit .env if needed (DB credentials)
npm run dev
```
Server runs at http://localhost:3000

### 3. Frontend
```bash
cd frontend
npm install
npx ng serve
```
App runs at http://localhost:4200

## Demo Accounts
| Email | Role | Password |
|-------|------|----------|
| john.gilbert@company.com | Requestor | password123 |
| sarah.chen@company.com | Scrub Team | password123 |
| mike.johnson@company.com | Committee | password123 |
| admin@company.com | Admin | password123 |

## Workflow
1. **Requestor** fills out the Intake Form and submits
2. **Scrub Team** reviews → Approve / Reject / Need Info
3. **Committee** reviews → Approve / Reject / Need Info
4. **Approved** → Development starts

If questions arise at any stage, the request loops back to the requestor for clarification.
