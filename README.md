# Revenue & Treasury Management System

This project is organized into separate **Backend** and **Frontend** applications.

## Project Structure

```
revenue-treasury-system/
├── backend/                  # Express.js REST API & PostgreSQL Service
│   ├── uploads/              # Uploaded documents / attachments
│   ├── db.js                 # PostgreSQL Pool connection
│   ├── server.js             # Express API server & routes
│   ├── package.json          # Backend dependencies and scripts
│   ├── .env.example          # Sample environment configuration
│   └── .gitignore
├── frontend/                 # React 19 + TypeScript + Vite Application
│   ├── public/               # Static assets & icons
│   ├── src/                  # React UI components, pages & services
│   ├── index.html            # Entry HTML
│   ├── vite.config.ts        # Vite build config
│   ├── package.json          # Frontend dependencies and scripts
│   ├── .env.example          # Frontend environment configuration
│   └── .gitignore
├── package.json              # Root orchestration scripts
├── .gitignore                # Root gitignore rules
└── README.md
```

## Quick Start

### 1. Install Dependencies
You can install dependencies for both services from the root folder:
```bash
npm run install:all
```
Or individually:
```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Configure Environment Variables
- **Backend**: Copy `backend/.env.example` to `backend/.env` and update your PostgreSQL credentials and server port.
- **Frontend**: Copy `frontend/.env.example` to `frontend/.env` if you need to point to a custom API URL.

### 3. Run Development Servers
From the root directory:
```bash
# Run Frontend (Vite on http://localhost:5173)
npm run dev:frontend

# Run Backend (Express API on http://localhost:3000)
npm run dev:backend
```

Or from their respective directories:
```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

### 4. Build Frontend for Production
```bash
npm run build:frontend
```
