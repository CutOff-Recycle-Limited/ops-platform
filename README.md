# OPS Platform — Jira-like Operations Management System

A production-ready, full-stack operations management platform with Kanban boards, custom workflows, team management, and activity tracking.

---

## Tech Stack

| Layer     | Technology                      |
|-----------|---------------------------------|
| Frontend  | React 18 + Vite + Tailwind CSS  |
| Backend   | Node.js + Express               |
| Database  | PostgreSQL                      |
| Auth      | JWT (Bearer tokens)             |

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

---

### 1. Database Setup

```bash
# Create the database
createdb ops_platform

# Or via psql
psql -U postgres -c "CREATE DATABASE ops_platform;"
```

---

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your database credentials

# Run migrations + seed demo data
npm run migrate

# Start the API server
npm run dev
# → Runs on http://localhost:3001
```

**Backend `.env`:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/ops_platform
JWT_SECRET=your-strong-secret-here
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
# → Runs on http://localhost:5173
```

---

## Demo Credentials

After running migrations, the following accounts are seeded:

| Email              | Password     | Role    |
|--------------------|--------------|---------|
| admin@ops.com      | password123  | Admin   |
| mercy@ops.com      | password123  | Manager |
| jackson@ops.com    | password123  | Member  |
| kephason@ops.com   | password123  | Member  |

Two demo operations are pre-loaded:
- **PROD** — Production & R&D (with 5 sample tasks across a 4-status workflow)
- **SALE** — Sales & Distribution (with a lead-to-close sales workflow)

---

## Project Structure

```
ops-platform/
├── backend/
│   ├── server.js                    # Express entry point
│   ├── .env.example
│   └── src/
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   ├── operations.controller.js
│       │   ├── tasks.controller.js
│       │   ├── comments.controller.js
│       │   └── dashboard.controller.js
│       ├── middleware/
│       │   ├── auth.js              # JWT verify, role guards
│       │   └── error.js             # Global error handler
│       ├── routes/
│       │   └── index.js             # All API routes
│       └── db/
│           ├── index.js             # pg Pool connection
│           ├── schema.sql           # Full PostgreSQL schema
│           └── migrate.js           # Migration + seed runner
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx                  # Router
        ├── index.css                # Global styles + design tokens
        ├── services/
        │   └── api.js               # Centralized fetch client
        ├── hooks/
        │   ├── useAuth.jsx          # Auth context + hook
        │   ├── useOperations.js
        │   └── useTasks.js
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── DashboardPage.jsx
        │   ├── OperationsPage.jsx
        │   ├── KanbanPage.jsx       # Main Kanban board
        │   └── SettingsPage.jsx
        └── components/
            ├── Layout.jsx           # Sidebar + outlet
            ├── Avatar.jsx
            ├── Modal.jsx
            ├── PriorityBadge.jsx
            ├── TaskCard.jsx         # Draggable Kanban card
            ├── TaskModal.jsx        # Full task detail/edit view
            └── CreateTaskModal.jsx
```

---

## API Reference

### Auth
| Method | Endpoint           | Description          |
|--------|--------------------|----------------------|
| POST   | /api/auth/register | Register new user    |
| POST   | /api/auth/login    | Login, get JWT       |
| GET    | /api/auth/me       | Current user info    |
| GET    | /api/auth/users    | List all users       |

### Operations
| Method | Endpoint                              | Description             |
|--------|---------------------------------------|-------------------------|
| GET    | /api/operations                       | List user's operations  |
| POST   | /api/operations                       | Create operation        |
| GET    | /api/operations/:id                   | Get operation + members |
| PUT    | /api/operations/:id                   | Update operation        |
| DELETE | /api/operations/:id                   | Delete (admin only)     |
| POST   | /api/operations/:id/members           | Add member              |
| DELETE | /api/operations/:id/members/:userId   | Remove member           |
| GET    | /api/operations/:id/workflow          | Get workflow + statuses |

### Tasks
| Method | Endpoint                          | Description                      |
|--------|-----------------------------------|----------------------------------|
| GET    | /api/operations/:id/tasks         | List tasks (filterable)          |
| POST   | /api/operations/:id/tasks         | Create task                      |
| GET    | /api/tasks/:id                    | Get task detail + comments       |
| PUT    | /api/tasks/:id                    | Update task fields               |
| PATCH  | /api/tasks/:id/transition         | Move task status via workflow    |
| DELETE | /api/tasks/:id                    | Delete task                      |

### Comments
| Method | Endpoint               | Description     |
|--------|------------------------|-----------------|
| POST   | /api/tasks/:id/comments| Add comment     |
| PUT    | /api/comments/:id      | Edit comment    |
| DELETE | /api/comments/:id      | Delete comment  |

### Dashboard
| Method | Endpoint       | Description                              |
|--------|----------------|------------------------------------------|
| GET    | /api/dashboard | Stats, overdue tasks, workload, activity |

---

## Key Features

### Workflow Engine
Every operation gets a workflow with statuses and allowed transitions. Tasks can **only** move between statuses via defined transitions — enforced server-side on `PATCH /tasks/:id/transition`. The Kanban drag-and-drop checks these transitions before updating.

### Kanban Drag & Drop
Uses native HTML5 drag-and-drop. Optimistic UI updates immediately, then confirms with the server. Reverts on failure with an error message.

### Role-Based Access
- **Admin**: Full access to all operations, can delete
- **Manager**: Can manage their assigned operations
- **Member**: Can view and update tasks in their operations

### Activity Log
Every status change, comment, create, and edit is recorded in `activity_logs` and shown in the task detail modal's Activity tab.

---

## Production Deployment Notes

1. Set `NODE_ENV=production` and a strong `JWT_SECRET`
2. Use a managed PostgreSQL instance (Supabase, Neon, RDS)
3. Build the frontend: `npm run build` in `/frontend`
4. Serve the built frontend from Express or a CDN (Vercel, Netlify)
5. Set `FRONTEND_URL` to your production domain for CORS

---

## Extending the System

- **Notifications**: Add a `notifications` table + WebSocket (socket.io) for real-time updates
- **File attachments**: Add S3/R2 upload to tasks
- **Workflow editor UI**: The transitions schema supports building a drag-and-drop workflow designer
- **Sprints**: Add a `sprints` table linked to operations with date ranges
- **Reports**: The activity_logs + tasks tables support rich time-series reporting
