# EventHub — Fullstack Event Booking App

A simple fullstack event booking application built with **HTML, Tailwind CSS, Alpine.js, Font Awesome, Express.js, Node.js, and SQLite**.

## Project Structure

```
event-booking-app/
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── backend/
    ├── .env
    ├── .env.example
    ├── package.json
    ├── server.js
    ├── db/database.js
    ├── middleware/auth.js
    ├── utils/stateMachine.js
    └── routes/
        ├── auth.js
        ├── events.js
        └── bookings.js
```

## State Machines

### 1. Event Lifecycle
- `DRAFT` → `PUBLISHED` (Admin publishes event)
- `PUBLISHED` → `CANCELLED` (Admin cancels event; auto-cancels active bookings)
- `PUBLISHED` → `COMPLETED` (Admin marks event as finished)

### 2. Booking Lifecycle
- `PENDING` → `CONFIRMED` (Admin approves booking)
- `PENDING` → `CANCELLED` (User or Admin cancels; seats are restored)
- `CONFIRMED` → `CANCELLED` (User or Admin cancels; seats are restored)

## How to Run Locally

1. **Start the Backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```
   The API runs on `http://localhost:5000`.

2. **Start the Frontend:**
   Open `frontend/index.html` with the **Live Server** extension in VS Code (or any static file server).

## Demo Accounts (Seeded Automatically)
- **Admin:** `admin@eventhub.com` / `admin123`
- **Public User:** `student@eventhub.com` / `user123`
