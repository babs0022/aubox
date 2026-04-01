# Aubox Landing Page (Subdirectory)

Next.js landing page for Aubox hosted at `/landing` subdirectory within the main aubox project.

## Quick Start

```bash
cd landing
npm install
npm run dev
```

Runs on: **http://localhost:3001**

## Structure

```
aubox/landing/
├── src/app/
│   ├── layout.tsx       (Root layout)
│   ├── page.tsx         (Landing page)
│   └── globals.css      (Tailwind + animations)
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── postcss.config.js
```

## Key Features

- **Premium Design**: Gradient hero, animated orbs, smooth animations
- **Zero Config**: Hardcoded links to `https://dashboard.aubox.app`
- **Responsive**: Mobile-first, full responsiveness
- **Fast**: Static generation, minimal bundle

## Production

```bash
npm run build
npm start
```

Runs on port 3001 by default (configurable in package.json scripts).

## Design System

- **Colors**: Teal (#0a6e5d), Paper (#fffdf8), Ink (#151515), Muted (#574f46)
- **Typography**: Work Sans (Google Fonts)
- **Animations**: Float, rotate, scale effects on background orbs and hero circles
