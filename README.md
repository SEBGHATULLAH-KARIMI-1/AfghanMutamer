# Hajj & Umrah Management System

A full-featured management panel for Hajj and Umrah service companies — built with React.js + Vite + React Router + Chart.js + jsPDF + SheetJS.

## Features
- Dashboard with live charts and statistics
- Full pilgrim management (add, edit, delete, photo upload, profile print)
- Payment management with PDF receipt export
- Reporting with time filters and PDF / Excel export
- Employee management
- Expense tracking
- Companies module with per-company sub-pages (info, pilgrims, payments, receipts)
- Activity log
- Role-based access control (RBAC)
- General settings, user management, backup / restore
- Light / Dark mode, full RTL layout
- Multi-currency support (AFN / USD)
- All data stored in browser LocalStorage (persists across refreshes)

## Setup

```bash
# 1. Navigate to the project folder
cd hajj-umrah-system

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev

# 4. Production build
npm run build
```

Open `http://localhost:5173` in your browser after running `npm run dev`.

## Demo Credentials
- Username: `admin`
- Password: `admin123`

Second user: `accountant` / `acc123`

## Project Structure
```
src/
  components/
    common/      ← Reusable UI components (Modal, Table, Skeleton, ...)
    layout/      ← Sidebar, Navbar, main layout
  contexts/      ← Auth, Data, Theme, Toast (Context API)
  pages/         ← Application pages
  utils/         ← LocalStorage, Jalali date, PDF/Excel export, seed data
```

## Deployment

### GitHub Pages
1. Run `npm run build`
2. Copy `dist/` contents to a `docs/` folder
3. Add a `.nojekyll` file inside `docs/`
4. Commit and push
5. Go to repo Settings > Pages > Source: **Deploy from a branch**, Branch: `main`, Folder: `/docs`

## Notes
- Sample data (pilgrims, payments, employees) is auto-generated on first run.
- To reset all data, clear the browser's LocalStorage for this domain or use Incognito mode.
- PDF output uses Latin/numeric fonts by default (jsPDF has no built-in Persian font). For full Persian PDF support, add a Persian font to jsPDF.
