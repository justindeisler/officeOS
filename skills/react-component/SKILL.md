---
name: react-component
description: Generate React components with TypeScript, Framer Motion animations, and Tailwind CSS styling. Use this skill when creating new UI components, especially for the archival folder interface project. Triggers on requests like "create a component", "scaffold a component", or "new React component".
---

# React Component Generator

Generate production-ready React components following project conventions.

## Component Structure

Create components with this structure:

```tsx
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

interface ComponentNameProps {
  // Define props with JSDoc comments
  /** Primary content */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function ComponentName({ children, className }: ComponentNameProps) {
  return (
    <motion.div
      className={cn('base-styles', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

## Guidelines

1. **TypeScript**: Always use explicit prop interfaces with JSDoc comments
2. **Framer Motion**: Include animation props using project easing `[0.16, 1, 0.3, 1]`
3. **Tailwind**: Use utility classes with `cn()` helper for conditional styling
4. **Naming**: Use PascalCase for components, match filename to component name
5. **Exports**: Use named exports, not default exports

## Animation Presets

Standard animation durations:
- **Fast**: 200ms (micro-interactions, hovers)
- **Normal**: 400ms (component transitions)
- **Slow**: 600ms (page transitions, complex reveals)

Standard easing:
- **Expo Out**: `[0.16, 1, 0.3, 1]` - Primary easing for most animations
- **Back Out**: `[0.34, 1.56, 0.64, 1]` - For playful, bouncy effects

## File Placement

Place components in appropriate directories:
- `src/components/ui/` - Reusable UI primitives
- `src/components/layout/` - Layout components (Navbar, Container)
- `src/components/folders/` - Folder-related components
- `src/components/documents/` - Document-related components

## Example Usage

When asked to create a component:

1. Determine component type and appropriate directory
2. Create the component file with proper structure
3. Add to any relevant barrel exports (index.ts)
4. Include basic animation and styling

## Checklist

Before completing component creation:
- [ ] Props interface defined with types
- [ ] Framer Motion animation included
- [ ] Tailwind classes use design tokens (CSS variables)
- [ ] Component is accessible (semantic HTML, focus states)
- [ ] File placed in correct directory
