# MRU Dashboard - University ERP System

A modern, full-stack University ERP Dashboard built with Next.js, Express, TypeScript, and Supabase. Features include face recognition for student identification, AI-powered course code generation using Google Gemini, and a sleek minimalistic UI.

## ✨ Features

### 🎯 Core Features
- **Teacher Authentication**: Secure login/signup with JWT-based authentication
- **Student Management**: Complete CRUD operations for student records
- **Course Management**: Create and manage courses with automatic code generation
- **Face Recognition**: Identify students using facial recognition technology
- **AI Course Codes**: Generate unique course codes using Google Gemini AI

### 🔍 Search Capabilities
- Roll number search
- Name-based filtering
- Department/Class/Year selection
- Face recognition matching

### 🎨 UI/UX
- Modern, minimalistic design
- Responsive layout for all devices
- Dark/Light theme support
- Smooth animations with Framer Motion
- Toast notifications

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Zustand** - State management
- **Framer Motion** - Animations
- **face-api.js** - Face detection and recognition
- **Sonner** - Toast notifications

### Backend
- **Express 5** - Node.js framework
- **TypeScript** - Type safety
- **Supabase** - PostgreSQL database
- **JWT** - Authentication
- **Google Gemini AI** - Course code generation
- **Multer & Sharp** - Image processing

## 📁 Project Structure

```
mru-dashboard/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── lib/             # Supabase & Gemini clients
│   │   ├── middleware/      # Auth, error handling, validation
│   │   ├── routes/          # API endpoints
│   │   ├── types/           # TypeScript interfaces
│   │   └── index.ts         # Server entry point
│   ├── database/
│   │   └── schema.sql       # Database schema
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages
│   │   │   ├── dashboard/   # Protected dashboard routes
│   │   │   ├── login/       # Login page
│   │   │   └── register/    # Registration page
│   │   ├── components/      # React components
│   │   │   ├── layout/      # Header, Sidebar
│   │   │   └── ui/          # Reusable UI components
│   │   ├── lib/             # API client, utilities
│   │   └── store/           # Zustand stores
│   └── package.json
│
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Google Gemini API key

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/mru-dashboard.git
cd mru-dashboard
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the database schema from `backend/database/schema.sql` in the SQL Editor
3. Copy your project URL and API keys

### 3. Configure Environment Variables

**Backend** (`backend/.env`):
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
JWT_SECRET=your_jwt_secret_min_32_chars
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:3000
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 4. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 5. Run the Development Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 📖 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new teacher |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/verify` | Verify token |

### Students
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students` | Get all students (paginated) |
| GET | `/api/students/:id` | Get student by ID |
| GET | `/api/students/roll/:rollNumber` | Get student by roll number |
| POST | `/api/students` | Create student |
| PUT | `/api/students/:id` | Update student |
| DELETE | `/api/students/:id` | Delete student |
| POST | `/api/students/:id/image` | Upload student image |

### Courses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/courses` | Get all courses (paginated) |
| GET | `/api/courses/:id` | Get course by ID |
| POST | `/api/courses` | Create course |
| PUT | `/api/courses/:id` | Update course |
| DELETE | `/api/courses/:id` | Delete course |
| POST | `/api/courses/generate-code` | Generate course code with AI |
| POST | `/api/courses/validate-code` | Validate course code |

### Face Recognition
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/face/encodings` | Get all face encodings |
| POST | `/api/face/encoding/:studentId` | Store face encoding |
| DELETE | `/api/face/encoding/:studentId` | Delete face encoding |

### General
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/departments` | Get all departments |
| POST | `/api/departments` | Create department |
| GET | `/api/classes` | Get all classes |
| POST | `/api/classes` | Create class |
| GET | `/api/stats` | Get dashboard statistics |

## 🎨 Course Code Format

The AI generates course codes following university standards:

- **Regular courses**: `CSH422B-T` (Dept + Course Number + Section - Type)
- **MOOC courses**: `MOOC-24O-CSH-307` (MOOC prefix + Year + Online + Dept + Number)
- **Electives**: `ELEC-CSH-401` (ELEC prefix + Dept + Number)

## 🔐 Security Features

- JWT-based authentication with 7-day expiration
- Password hashing with bcrypt (12 rounds)
- CORS configuration
- Rate limiting (100 requests per 15 minutes)
- Helmet security headers
- Input validation with express-validator

## 📱 Responsive Design

The dashboard is fully responsive and works on:
- Desktop (1920px+)
- Laptop (1024px - 1919px)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Google Gemini](https://ai.google.dev/)
- [face-api.js](https://github.com/justadudewhohacks/face-api.js/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
# mru-cst-dashboard
# mru-dashboard
