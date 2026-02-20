# Exam Evaluation System - Frontend

A modern, responsive React application for exam evaluation and student assessment.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui (Radix UI)
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v6

## Development Setup

### Prerequisites

- Node.js 18+ (or 20/22 LTS recommended)
- npm or yarn

### Installation

```sh
# Navigate to the frontend directory
cd docker/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:8080`

## Available Scripts

```sh
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Build in development mode
npm run build:dev

# Run tests
npm run test

# Run tests in watch mode
npm test:watch

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Docker

```sh
# Build and run with Docker Compose
cd docker
docker-compose up frontend
```

The frontend will be accessible at `http://localhost:8080`

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── context/       # React Context providers
├── hooks/         # Custom React hooks
├── services/      # API services
├── types/         # TypeScript type definitions
├── lib/           # Utility functions
├── test/          # Test setup and utilities
├── App.tsx        # Main App component
├── main.tsx       # Entry point
└── index.css      # Global styles
```

## Features

- Student Dashboard
- Faculty Dashboard
- Evaluation Viewer
- Responsive Design
- Dark/Light Theme Support
- Real-time Updates with React Query
