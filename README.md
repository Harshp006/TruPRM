# TruPRM

TruPRM is a platform for pull request monitoring, management, and process automation.

## Phase Checklist
- [x] Phase 0: Monorepo & Core Setup
- [ ] Phase 1: Authentication & User Management
- [ ] Phase 2: Core Data Models & APIs
- [ ] Phase 3: Elasticsearch Integration & Search Features
- [ ] Phase 4: Frontend UI & Integration

## Progress Log
- Phase 0 complete: Monorepo initialized with /client (React + Vite + Tailwind CSS) and /server (Node + Express + Prisma, TypeScript), GET /health returns {status: "ok"}, and client dev server loaded with Tailwind CSS.

## Docker Setup
To set up and run the application using Docker, follow these steps:

1. Start the Docker containers in detached mode:
   ```bash
   docker compose up -d
   ```

2. Run Prisma migrations to set up the database schema:
   ```bash
   npx prisma migrate dev
   ```

3. Seed the database with initial data:
   ```bash
   npx prisma db seed
   ```
