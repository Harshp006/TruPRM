# TruPRM

Welcome to TruPRM.

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
