# K-Loading Financial Management System

A comprehensive financial management application built with React, Node.js, and PostgreSQL, designed for Vietnamese businesses with real-time collaboration features.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or pnpm package manager

### Environment Setup

1. **Clone and Install Dependencies**
```bash
git clone <repository-url>
cd k-loading-financial
npm install
```

2. **Environment Configuration**
Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database_name

# JWT Configuration  
JWT_SECRET=your-super-secret-jwt-key-here

# Email Service (Optional)
EMAIL_ENCRYPTION_KEY=your-32-character-encryption-key

# Development Settings
NODE_ENV=development
PORT=5000
```

3. **Database Setup**
```bash
# Push database schema
npm run db:push

# Optional: Generate migrations
npm run db:generate
```

4. **Start Development Server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## 📁 Project Structure

```
├── client/          # React frontend (TypeScript)
├── server/          # Express.js backend (TypeScript)
├── shared/          # Shared types and schemas
├── packages/        # Internal packages
│   └── data-center/ # Vietnamese data processing
└── scripts/         # Database and utility scripts
```

## 🛠 Technology Stack

### Frontend
- **React 18** - Main UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling framework
- **Vite** - Build tool and dev server
- **TanStack Query** - Server state management
- **Wouter** - Lightweight routing
- **Radix UI + shadcn/ui** - Component library

### Backend
- **Node.js + Express.js** - Server framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Database operations
- **PostgreSQL** - Primary database
- **JWT** - Authentication
- **WebSocket** - Real-time collaboration

### Key Features
- 💰 Budget and expense management
- 👥 Multi-user collaboration with role-based access
- 📊 Real-time financial reporting
- 📧 Email management with IMAP/SMTP
- 🔄 Live data synchronization
- 📱 Responsive design

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start development server
npm run dev:client       # Frontend only
npm run dev:server       # Backend only

# Database
npm run db:push          # Apply schema changes
npm run db:generate      # Generate migrations
npm run db:studio        # Open Drizzle Studio

# Build & Deploy
npm run build           # Build for production
npm run start           # Start production server
```

## 🌐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Secret key for JWT tokens | ✅ |
| `EMAIL_ENCRYPTION_KEY` | 32-char key for email encryption | ⚠️ |
| `NODE_ENV` | Environment (development/production) | ✅ |
| `PORT` | Server port (default: 5000) | ❌ |

## 🔐 Authentication

The system supports:
- **Director** - Full system access
- **Manager** - Department-level access  
- **Employee** - Limited access with inheritance

## 📧 Email Management

Supports Gmail, Outlook, and Yahoo with:
- App Password authentication
- IMAP/SMTP connectivity
- AES-256 encryption for credentials
- Real-time email synchronization

## 🚀 Deployment

### Replit Deployment
This project is optimized for Replit deployment. Simply:
1. Import the project to Replit
2. Configure environment variables in Secrets
3. Run the project

### Manual Deployment
1. Set `NODE_ENV=production`
2. Configure production database
3. Build the project: `npm run build`
4. Start: `npm start`

## 📝 License

Private commercial application for K-Loading Financial services.

## 🤝 Support

For technical support or feature requests, please contact the development team.