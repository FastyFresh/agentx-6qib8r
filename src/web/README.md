# AGENT AI Platform Web Frontend

## Overview

Modern, enterprise-grade web interface for the AGENT AI Platform built with React 18.2+ and TypeScript 5.0+, providing a robust and scalable solution for AI agent management.

![Node Version][node-version]
![React Version][react-version]
![TypeScript Version][typescript-version]

## Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- Git >= 2.0.0
- VS Code (recommended)

## Quick Start

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Set up environment variables:
```bash
cp .env.example .env
```
4. Start development server:
```bash
npm run dev
```

## Technology Stack

- **Framework**: React 18.2.0
- **Language**: TypeScript 5.0+
- **State Management**: Redux Toolkit 1.9.5
- **Data Fetching**: React Query 4.0.0
- **UI Components**: Material-UI 5.14.0
- **Styling**: Emotion/Styled Components
- **Forms**: React Hook Form 7.45.0
- **Routing**: React Router 6.14.0
- **Testing**: Jest 29.6.0 + Testing Library
- **Build Tool**: Vite 4.4.0

## Project Structure

```
src/
├── assets/          # Static assets
├── components/      # Reusable UI components
├── config/          # Configuration files
├── features/        # Feature-based modules
├── hooks/           # Custom React hooks
├── layouts/         # Page layouts
├── lib/            # Third-party library configurations
├── pages/          # Route pages
├── services/       # API services
├── store/          # Redux store configuration
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code
- `npm run typecheck` - Check types
- `npm run security:audit` - Run security audit
- `npm run analyze` - Analyze bundle size

### Code Style

This project follows strict TypeScript configuration with the following key features:
- Strict null checks
- No implicit any
- No unused locals/parameters
- Consistent casing
- ESLint + Prettier integration

### Testing Strategy

- Unit tests for utilities and hooks
- Component tests with React Testing Library
- Integration tests for complex features
- E2E tests with Cypress (separate configuration)
- Minimum 80% code coverage requirement

## Security

- OAuth 2.0 + OIDC authentication via Auth0
- Secure HTTP-only cookies
- CSRF protection
- Content Security Policy
- Regular dependency audits
- XSS prevention
- Rate limiting

## Performance Optimization

- Code splitting by route
- Lazy loading of components
- Image optimization
- Caching strategies
- Bundle size monitoring
- Performance monitoring via Sentry

## Deployment

### Build Process

1. Static analysis:
```bash
npm run typecheck && npm run lint
```

2. Run tests:
```bash
npm run test
```

3. Build for production:
```bash
npm run build
```

### Environment Configuration

Required environment variables:
- `VITE_API_URL` - Backend API URL
- `VITE_AUTH0_DOMAIN` - Auth0 domain
- `VITE_AUTH0_CLIENT_ID` - Auth0 client ID
- `VITE_AUTH0_AUDIENCE` - Auth0 API audience

## Monitoring & Logging

- Runtime error tracking via Sentry
- Performance monitoring
- User analytics via Segment
- Structured logging with Winston

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## Contributing

1. Branch naming convention: `feature/`, `bugfix/`, `hotfix/`
2. Commit message format: Conventional Commits
3. Pull request template must be followed
4. Code review required before merge
5. CI checks must pass

## Troubleshooting

Common issues and solutions:

1. **Build Failures**
   - Clear node_modules and package-lock.json
   - Run `npm clean-install`

2. **Type Errors**
   - Run `npm run typecheck` for detailed errors
   - Check @types packages versions

3. **Performance Issues**
   - Check React DevTools for unnecessary renders
   - Run `npm run analyze` for bundle analysis

## Support

- Technical Lead: [contact@email.com](mailto:contact@email.com)
- Documentation: [Internal Wiki Link]
- Issue Tracker: [JIRA Link]

## License

Private and Confidential - AGENT AI Platform

[node-version]: https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen
[react-version]: https://img.shields.io/badge/react-18.2.0-blue
[typescript-version]: https://img.shields.io/badge/typescript-5.0.0-blue