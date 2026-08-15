## Technical Stack
- Backend: Node.js + TypeScript + Express
- Frontend: React + TypeScript + Vite
- Database: MySQL
- Validation: Zod

## Project structure

habit-tracker-takehome/
├── backend/
│   ├── src/server.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/main.tsx
│   ├── src/styles.css
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── database/schema.sql
├── docs/code-review.md
└── README.md

## Run locally

### 1. Create the database

Start MySQL and run:

``` bash
mysql -u root -p < database/schema.sql
```
The schema creates `habit_tracker`, a demo user with ID `1`, and three demo habits.

### 2. Start the backend

``` bash
cd backend
cp .env.example .env
npm install
npm run dev
```
The API runs on `http://localhost:3000`.

### 3. Start the frontend

In a second terminal:

``` bash
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal, normally `http://localhost:5173`.



