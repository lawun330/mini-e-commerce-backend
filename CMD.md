# Commands To Run In This Repository

## Local Development (No Docker)

1. Create project (one-time)

   ```bash
   # create a NestJS project
   npx @nestjs/cli new mini-e-commerce-backend
   cd mini-e-commerce-backend

   # create a Postgresql DB locally
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Initialize Prisma (one-time)

   ```bash
   npx prisma init
   ```

4. Set up environment

   ```bash
   # create .env file from .env.example
   ```

5. Migrate database

   ```bash
   # for the first migration (one-time)
   npx prisma migrate dev --name init
   
   # for new schema changes
   npx prisma migrate dev --name change_name

   # after pull, refresh the Prisma client
   npx prisma generate
   ```

6. Seed database

   ```bash
   npm run prisma:seed
   ```

7. Run the API

   ```bash
   # 1. start Postgresql service
   sudo systemctl start postgresql

   # 2. shutdown any docker containers
   npm run docker:down

   # 3. start
   npm run start:dev

   # 4. check URLs
   ```

   - Troubleshooting

      ```bash
      # 3a. for dist/main errors on start
      rm -f tsconfig.build.tsbuildinfo
      npm run start:dev
      ```

8. Quality

   ```bash
   npm run lint            # lint with eslint
   npm run format          # format with prettier
   npx prettier --write .  # format alt command
   npx prettier --check .  # check only
   ```

9. Tests
   ```bash
   npm test              # unit tests of service logic behind endpoints
   npm run test:e2e      # end-to-end API tests with seeded DB (preferably)
   ```
---

## Local Development (Docker)

1. Set up environment

   ```bash
   # create .env file from .env.example
   ```

2. Run the API

   ```bash
   # 1. stop Postgresql service
   sudo systemctl stop postgresql

   # 2. build Docker image, start Postgres DB + API, run migrations
   npm run docker:up

   # 3. seed or load sample data after Postgres DB is up
   npm run docker:seed

   # 4. check URLs
   ```

3. Other commands

   ```bash
   # follow API logs
   npm run docker:logs

   # shut down any docker containers
   npm run docker:down
   ```

---

## Render Deployment (Docker)

See [DEPLOY.md](DEPLOY.md)

---

## `package.json` Shortcuts

```bash
# local development # no Docker
npm run build
npm run start
npm run start:dev
npm run start:debug
npm run start:prod

# quality
npm run lint
npm run format

# tests
npm test
npm run test:watch
npm run test:cov
npm run test:debug
npm run test:e2e

# prisma
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run prisma:seed

# local development # Docker
npm run docker:up
npm run docker:down
npm run docker:logs
npm run docker:seed
```
