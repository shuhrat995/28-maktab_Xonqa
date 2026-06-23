
# State School No.28 Website

A premium, fully functional school website built with React, TypeScript, and Express.js. Features a beautiful, animated frontend and a comprehensive admin panel for content management.

## Features

- **Modern React Frontend**: Built with TypeScript, Tailwind CSS, and Framer Motion animations
- **Responsive Design**: Mobile-first approach with beautiful UI components
- **Multi-language Support**: English, Russian, and Uzbek translations
- **Admin Panel**: Full-featured React admin dashboard for content management
- **Backend API**: Express.js with TypeScript, authentication, and file uploads
- **Contact Form**: Functional contact form with email notifications
- **Content Management**: Editable page sections, news, gallery, and teacher profiles
- **Security**: Authentication, rate limiting, input validation, and sanitization

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Framer Motion for animations
- shadcn/ui component library
- React Router for navigation
- Sonner for toast notifications

### Backend
- Express.js with TypeScript
- Nodemailer for email sending
- Multer for file uploads
- bcryptjs for password hashing
- JSON Web Tokens for authentication
- Rate limiting and security middleware

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd state-school-website
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Configure environment variables**

   Copy `backend/.env.example` to `backend/.env` and fill in secure values.
   For production deployment, also use `.env.production.example` in the project root.

5. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```

6. **Start the frontend (in a new terminal)**
   ```bash
   npm run dev
   ```

7. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Admin Panel: http://localhost:5173/admin
   - Hidden admin aliases: `/maktab28-boshqaruv`, `/xonqa-28-panel`

### Admin Credentials
- Admin credentials are loaded from `backend/.env`
- Do not keep default or previously exposed passwords

## Project Structure

```
├── src/                    # React frontend
│   ├── app/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Shared components
│   │   └── translations/  # i18n files
│   └── styles/            # CSS files
├── backend/               # Express backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── controllers/   # Business logic
│   │   ├── middleware/    # Custom middleware
│   │   └── utils/         # Utilities
│   └── uploads/           # Uploaded files
└── admin/                 # Legacy admin panel (replaced by React admin)
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `GET /api/auth/profile` - Get admin profile

### Content Management
- `GET /api/content` - Get news/gallery items
- `POST /api/content` - Create new content
- `PUT /api/content/:id` - Update content
- `DELETE /api/content/:id` - Delete content

### Teachers
- `GET /api/teachers` - Get all teachers
- `POST /api/teachers` - Add new teacher
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher

### Sections
- `GET /api/sections/:page` - Get page content
- `PUT /api/sections/:page` - Update page content

### Contact
- `POST /api/contact` - Send contact form

## Development

### Building for Production

1. **Build frontend**
   ```bash
   npm run build
   ```

2. **Build backend**
   ```bash
   cd backend
   npm run build
   ```

## Deployment

- Railway backend deploy guide: [backend/RAILWAY_DEPLOY.md](backend/RAILWAY_DEPLOY.md)
- Frontend production env example: [.env.production.example](.env.production.example)
- On Vercel, set `BACKEND_ORIGIN` to the deployed backend origin. The frontend uses same-origin `/api/*`, and the Vercel API proxy forwards those requests to the backend.

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please contact the development team or create an issue in the repository.
  
