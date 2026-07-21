# Commands To Run In This Repository

1. Create Project

   ```bash
   npx @nestjs/cli new mini-e-commerce-backend
   cd mini-e-commerce-backend
   ```

2. Install Dependencies

   ```bash
   npm install
   ```

3. Initialize Prisma

   ```bash
   npx prisma init
   ```

4. Set up Environment

   ```bash
   cp .env.example .env
   # then edit .env
   ```

5. Migrate Database

   ```bash
   # for the first time for development
   npx prisma migrate dev --name init

   # for new schema changes for development
   npx prisma migrate dev --name change_name

   # for production or CI
   npx prisma migrate deploy
   ```

6. Refresh Schema Changes

   ```bash
   npx prisma generate
   ```

7. Seed Database

   ```bash
   npm run prisma:seed
   ```

8. Run Development

   ```bash
   npm run start:dev
   ```

9. Quality

   ```bash
   # lint with eslint
   npm run lint

   # format all files with prettier
   npm run format

   # or
   npx prettier --write .

   # check if code follows prettier formatting rules without modifying files
   npx prettier --check .
   ```

10. Tests

    ```bash
    npm run test
    npm run test:watch
    npm run test:cov
    npm run test:e2e
    ```

11. `package.json` Shortcuts

    ```bash
    npm run prisma:generate
    npm run prisma:migrate
    npm run prisma:seed
    ```
