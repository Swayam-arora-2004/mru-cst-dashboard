# MRU CST Dashboard - Frontend

A modern, scalable, and production-ready Next.js 16 application built with enterprise-level architecture and best practices.

## 🌟 Features

- ✅ **Next.js 16** with App Router
- ✅ **TypeScript** for type safety  
- ✅ **Tailwind CSS 4** with custom design system
- ✅ **Comprehensive Component Library** - 20+ reusable components
- ✅ **Custom Hooks Library** - 15+ production-ready hooks
- ✅ **Advanced Utilities** - 30+ helper functions
- ✅ **Form Validation** - Zod + React Hook Form
- ✅ **State Management** - Zustand
- ✅ **API Client** with interceptors and error handling
- ✅ **Dark Mode** support
- ✅ **Responsive Design** - Mobile-first approach
- ✅ **Accessibility** - WCAG 2.1 compliant
- ✅ **Performance Optimized** - Code splitting, lazy loading

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Backend API running on port 5000

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js pages
│   ├── components/
│   │   ├── layout/             # Layout components
│   │   └── ui/                 # UI component library
│   ├── lib/
│   │   ├── api-client.ts       # HTTP client
│   │   ├── constants.ts        # App constants
│   │   ├── hooks.ts            # Custom hooks
│   │   ├── utils.ts            # Utilities
│   │   └── validators.ts       # Validation functions
│   ├── store/                  # Zustand stores
│   └── types/                  # TypeScript types
└── ...config files
```

## 🎨 Design System

### Components

#### Form Components
- `<Button />` - 9 variants, 4 sizes, loading states
- `<Input />` - With labels, errors, icons
- `<Textarea />` - Character counter, auto-resize
- `<Checkbox />` - Custom styled with labels

#### Layout Components
- `<Card />` - Content containers with hover effects
- `<Dialog />` - Modal dialogs with animations
- `<Alert />` - Contextual messages

#### Feedback Components
- `<Skeleton />` - Loading placeholders
- `<Spinner />` - Loading indicators
- `<Badge />` - Status indicators

## 🪝 Custom Hooks

- `useLocalStorage` - Persist to localStorage
- `useMediaQuery` - Responsive breakpoints
- `useDebounce` - Debounce values
- `useToggle` - Boolean state
- `useClipboard` - Copy to clipboard
- And 10+ more...

## 🛠️ Utility Functions

- String: `capitalize`, `toTitleCase`, `toKebabCase`, `toCamelCase`
- Date: `formatDate`, `formatDateTime`, `formatRelativeTime`
- Array/Object: `unique`, `groupBy`, `pick`, `omit`
- Validation: `isValidEmail`, `isValidPhone`, `isValidPassword`

## 📚 Documentation

- [Architecture Guide](./ARCHITECTURE.md) - Detailed architecture documentation
- Component examples in `/src/components/ui`
- Utility examples in `/src/lib`

## 🤝 Contributing

1. Follow the existing code style
2. Write meaningful commit messages
3. Add TypeScript types
4. Update documentation
5. Test on multiple browsers

---

**Built with enterprise-level architecture for scalability and maintainability.**

