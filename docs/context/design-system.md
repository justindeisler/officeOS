# S-Tier SaaS Dashboard Design System

> **Component Library:** [shadcn/ui](https://ui.shadcn.com/) — Beautiful, accessible components built on Radix UI + Tailwind CSS

---

## I. Core Design Philosophy & Strategy

*   [ ] **Users First:** Prioritize user needs, workflows, and ease of use in every design decision.
*   [ ] **Meticulous Craft:** Aim for precision, polish, and high quality in every UI element and interaction.
*   [ ] **Speed & Performance:** Design for fast load times and snappy, responsive interactions.
*   [ ] **Simplicity & Clarity:** Strive for a clean, uncluttered interface. Ensure labels, instructions, and information are unambiguous.
*   [ ] **Focus & Efficiency:** Help users achieve their goals quickly and with minimal friction. Minimize unnecessary steps or distractions.
*   [ ] **Consistency:** Maintain a uniform design language (colors, typography, components, patterns) across the entire dashboard.
*   [ ] **Accessibility (WCAG AA+):** Design for inclusivity. Ensure sufficient color contrast, keyboard navigability, and screen reader compatibility. shadcn/ui components are built on Radix UI primitives which provide excellent accessibility out of the box.
*   [ ] **Opinionated Design (Thoughtful Defaults):** Establish clear, efficient default workflows and settings, reducing decision fatigue for users.

---

## II. Design System Foundation (Tokens & Core Components)

### Color Palette

shadcn/ui uses CSS variables for theming. Configure in `globals.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;

    /* Extended semantic colors */
    --success: 142 76% 36%;
    --success-foreground: 210 40% 98%;
    --warning: 38 92% 50%;
    --warning-foreground: 210 40% 98%;
    --info: 199 89% 48%;
    --info-foreground: 210 40% 98%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
```

*   [ ] **Primary Brand Color:** Customize `--primary` for your brand, used strategically.
*   [ ] **Neutrals:** Built into shadcn/ui via `--muted`, `--secondary`, `--accent` variables.
*   [ ] **Semantic Colors:** `--destructive` (red), extend with `--success` (green), `--warning` (amber), `--info` (blue).
*   [ ] **Dark Mode Palette:** Complete dark mode via `.dark` class, toggle with `next-themes`.
*   [ ] **Accessibility Check:** Ensure all color combinations meet WCAG AA contrast ratios (4.5:1 for text).

### Typography

shadcn/ui uses Inter by default. Configure in `tailwind.config.js`:

```js
fontFamily: {
  sans: ["Inter", "system-ui", "sans-serif"],
  mono: ["JetBrains Mono", "monospace"],
}
```

*   [ ] **Primary Font Family:** Inter (clean, legible sans-serif) or system-ui fallback.
*   [ ] **Modular Scale:** Use Tailwind's scale:
    *   H1: `text-4xl` (36px)
    *   H2: `text-3xl` (30px)
    *   H3: `text-2xl` (24px)
    *   H4: `text-xl` (20px)
    *   Body Large: `text-lg` (18px)
    *   Body Default: `text-base` (16px)
    *   Body Small/Caption: `text-sm` (14px)
*   [ ] **Font Weights:** Regular (400), Medium (500), SemiBold (600), Bold (700).
*   [ ] **Line Height:** Use `leading-relaxed` (1.625) for body text, `leading-tight` for headings.

### Spacing Units

*   [ ] **Base Unit:** 4px (Tailwind's default).
*   [ ] **Spacing Scale:** Use Tailwind spacing utilities:
    *   `space-1` (4px), `space-2` (8px), `space-3` (12px)
    *   `space-4` (16px), `space-6` (24px), `space-8` (32px)
*   [ ] **Consistent Application:** Apply spacing scale to all padding, margins, and gaps.

### Border Radii

*   [ ] **CSS Variable:** Use `--radius` (default 0.5rem) for consistency.
*   [ ] **Tailwind Classes:**
    *   Small: `rounded-sm` (calc(var(--radius) - 4px)) — for small inputs
    *   Medium: `rounded-md` (calc(var(--radius) - 2px)) — for buttons
    *   Large: `rounded-lg` (var(--radius)) — for cards, modals

---

## III. shadcn/ui Component Reference

### Core Components

| Category | shadcn/ui Component | States | Usage |
|----------|---------------------|--------|-------|
| **Buttons** | `Button` | default, hover, active, focus, disabled | Primary, secondary, destructive, outline, ghost, link variants; with icon options |
| **Inputs** | `Input`, `Textarea` | default, focus, error, disabled | Text entry with labels, placeholders, helper text, error messages |
| **Select** | `Select` | default, open, focus, disabled | Dropdown selection with Radix primitives |
| **Checkbox** | `Checkbox` | unchecked, checked, indeterminate, disabled | Boolean selection |
| **Radio** | `RadioGroup` | unselected, selected, disabled | Single selection from options |
| **Toggle** | `Switch` | off, on, disabled | On/off toggle |
| **Cards** | `Card`, `CardHeader`, `CardContent`, `CardFooter` | — | Content blocks, dashboard widgets |
| **Tables** | `Table`, `TableHeader`, `TableRow`, `TableCell` | hover, selected | Data display with sorting, filtering support |
| **Modals** | `Dialog`, `AlertDialog` | closed, open | Confirmations, forms, detailed views |
| **Navigation** | `NavigationMenu`, `Tabs`, `Breadcrumb` | default, active | Sidebar, tabs, breadcrumbs |
| **Badges** | `Badge` | default, secondary, destructive, outline | Status indicators, categorization |
| **Tooltips** | `Tooltip` | hidden, visible | Contextual help |
| **Progress** | `Progress`, `Skeleton` | — | Loading states, spinners |
| **Icons** | `lucide-react` | — | Single, modern, clean icon set (SVG) |
| **Avatars** | `Avatar` | with image, fallback | User images |

### Extended Components

| Category | shadcn/ui Component | Usage |
|----------|---------------------|-------|
| **Forms** | `Form` (react-hook-form + zod) | Complete form handling with validation |
| **Date Picker** | `Calendar`, `DatePicker` | Date selection with popover |
| **Combobox** | `Command` + `Popover` | Searchable select/autocomplete |
| **Toast** | `Sonner` or `Toast` | Notifications and feedback |
| **Dropdown** | `DropdownMenu` | Context menus, action menus |
| **Sheet** | `Sheet` | Slide-out panels (mobile nav, detail views) |
| **Accordion** | `Accordion` | Collapsible sections |
| **Alert** | `Alert` | Important messages (info, warning, error) |
| **Separator** | `Separator` | Visual dividers |
| **Scroll Area** | `ScrollArea` | Custom scrollbars |
| **Slider** | `Slider` | Range selection |
| **Hover Card** | `HoverCard` | Rich tooltips with preview content |

---

## IV. Layout, Visual Hierarchy & Structure

*   [ ] **Responsive Grid System:** Design based on a responsive grid (12-column) using Tailwind's `grid` utilities.
*   [ ] **Strategic White Space:** Use ample negative space (`p-6`, `gap-6`, `space-y-4`) to improve clarity and reduce cognitive load.
*   [ ] **Clear Visual Hierarchy:** Guide the user's eye using:
    *   Typography (size, weight, color)
    *   Spacing and grouping
    *   Element positioning and z-index
*   [ ] **Consistent Alignment:** Maintain consistent alignment using Tailwind's flexbox and grid utilities.

### Main Dashboard Layout

```tsx
import { SidebarProvider, Sidebar, SidebarContent } from "@/components/ui/sidebar"

export function DashboardLayout({ children }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarContent>
            {/* Navigation items */}
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
```

*   [ ] **Persistent Left Sidebar:** Use shadcn/ui `Sidebar` for primary navigation with collapsible support.
*   [ ] **Content Area:** Flexible main space for module-specific interfaces.
*   [ ] **Top Bar (Optional):** Global search, user profile (`Avatar` + `DropdownMenu`), notifications.
*   [ ] **Mobile-First Considerations:** Use `Sheet` for mobile navigation, responsive breakpoints (`md:`, `lg:`).

### Grid Patterns

```tsx
// Responsive grid for cards/widgets
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card>...</Card>
  <Card>...</Card>
  <Card>...</Card>
</div>

// Two-column layout with sidebar
<div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
  <main>...</main>
  <aside>...</aside>
</div>
```

---

## V. Interaction Design & Animations

*   [ ] **Purposeful Micro-interactions:** Use subtle animations for user actions (hovers, clicks, form submissions).
    *   Feedback should be immediate and clear.
    *   Use shadcn/ui's built-in Radix animations.
*   [ ] **Animation Timing:**
    *   Fast (150-200ms): Hovers, focus states, toggles
    *   Normal (200-300ms): Dropdowns, tooltips, accordions
    *   Slow (300-500ms): Modals, page transitions
*   [ ] **Easing:** Use `ease-out` or `cubic-bezier(0.16, 1, 0.3, 1)` for smooth motion.

### Tailwind Animation Config

```js
// tailwind.config.js
animation: {
  "accordion-down": "accordion-down 0.2s ease-out",
  "accordion-up": "accordion-up 0.2s ease-out",
  "fade-in": "fade-in 0.15s ease-out",
  "fade-out": "fade-out 0.15s ease-out",
  "slide-in-from-top": "slide-in-from-top 0.2s ease-out",
  "slide-in-from-bottom": "slide-in-from-bottom 0.2s ease-out",
  "scale-in": "scale-in 0.15s ease-out",
}
```

*   [ ] **Loading States:**
    *   Page loads: `Skeleton` components
    *   In-component actions: `Button` with loading spinner
    *   Data fetching: Skeleton tables/cards
*   [ ] **Transitions:** Smooth transitions for state changes, modal appearances, section expansions.
*   [ ] **Avoid Distraction:** Animations enhance usability, not overwhelm the user.
*   [ ] **Keyboard Navigation:** All interactive elements keyboard accessible.
*   [ ] **Focus States:** Clear focus rings via `--ring` color:

```css
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

---

## VI. Module Design Patterns

### A. Multimedia Moderation Module

```tsx
// Media card with moderation actions
<Card className="overflow-hidden">
  <CardContent className="p-0">
    <img src={media.url} className="aspect-video w-full object-cover" />
  </CardContent>
  <CardFooter className="flex justify-between p-4">
    <Badge variant={getStatusVariant(media.status)}>
      {media.status}
    </Badge>
    <div className="flex gap-2">
      <Button size="sm" variant="outline">
        <Check className="h-4 w-4 mr-1" /> Approve
      </Button>
      <Button size="sm" variant="destructive">
        <X className="h-4 w-4 mr-1" /> Reject
      </Button>
    </div>
  </CardFooter>
</Card>
```

*   [ ] **Clear Media Display:** Prominent image/video previews using `Card` (grid or list view).
*   [ ] **Obvious Moderation Actions:** `Button` components with distinct variants:
    *   Approve: `variant="outline"` or custom success variant
    *   Reject: `variant="destructive"`
    *   Flag: `variant="secondary"`
*   [ ] **Visible Status Indicators:** `Badge` with variants (`default`, `secondary`, `destructive`, `outline`).
*   [ ] **Contextual Information:** Display metadata (uploader, timestamp, flags) in `CardHeader` or `HoverCard`.
*   [ ] **Workflow Efficiency:**
    *   Bulk Actions: `Checkbox` selection with `DropdownMenu` toolbar
    *   Keyboard Shortcuts: For common moderation actions (j/k navigation, a/r approve/reject)
*   [ ] **Minimize Fatigue:** Clean interface, dark mode via `.dark` class toggle.

### B. Data Tables Module

Use shadcn/ui `DataTable` pattern with TanStack Table:

```tsx
import { DataTable } from "@/components/ui/data-table"
import { columns } from "./columns"

<DataTable
  columns={columns}
  data={data}
  searchKey="email"
  filterableColumns={[
    { id: "status", title: "Status", options: statusOptions }
  ]}
/>
```

*   [ ] **Readability & Scannability:**
    *   Smart Alignment: Left-align text, right-align numbers
    *   Clear Headers: Bold column headers with `TableHeader`
    *   Zebra Striping (Optional): `even:bg-muted/50` for dense tables
    *   Legible Typography: Use `text-sm` for table content
    *   Adequate Row Height: `h-12` minimum for comfortable clicking
*   [ ] **Interactive Controls:**
    *   Column Sorting: Clickable headers with sort indicators (TanStack Table)
    *   Intuitive Filtering: `Input` for search, `Select`/`Popover` for column filters
    *   Global Table Search: Search input above table
*   [ ] **Large Datasets:**
    *   Pagination: `Button` group or dedicated pagination component
    *   Virtual Scrolling: TanStack Virtual for 1000+ rows
    *   Sticky Headers: `sticky top-0` with `ScrollArea`
    *   Frozen Columns: If applicable for wide tables
*   [ ] **Row Interactions:**
    *   Expandable Rows: Accordion pattern within table
    *   Inline Editing: Click-to-edit with `Input` overlay
    *   Bulk Actions: `Checkbox` in first column with contextual toolbar
    *   Action Icons: `DropdownMenu` per row (Edit, Delete, View Details)

### C. Configuration Panels Module

```tsx
// Settings form with grouped sections
<Form {...form}>
  <Tabs defaultValue="general">
    <TabsList>
      <TabsTrigger value="general">General</TabsTrigger>
      <TabsTrigger value="notifications">Notifications</TabsTrigger>
      <TabsTrigger value="advanced">Advanced</TabsTrigger>
    </TabsList>

    <TabsContent value="general" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Configure your basic preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="siteName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Site Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>Your public site name</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter>
          <Button type="submit">Save Changes</Button>
        </CardFooter>
      </Card>
    </TabsContent>
  </Tabs>
</Form>
```

*   [ ] **Clarity & Simplicity:**
    *   Clear labels with `FormLabel`
    *   Helper text via `FormDescription`
    *   `Tooltip` for additional context on complex settings
*   [ ] **Logical Grouping:** Use `Tabs` or `Accordion` for related settings.
*   [ ] **Progressive Disclosure:** Hide advanced settings behind "Advanced" tab or `Accordion` item.
*   [ ] **Appropriate Input Types:**
    *   Text: `Input`, `Textarea`
    *   Boolean: `Switch`, `Checkbox`
    *   Selection: `Select`, `RadioGroup`
    *   Range: `Slider`
    *   Date: `Calendar` with `Popover`
*   [ ] **Visual Feedback:**
    *   `Sonner` toast for save confirmation
    *   `FormMessage` for inline validation errors
    *   Loading state on submit button
*   [ ] **Sensible Defaults:** Provide default values for all settings.
*   [ ] **Reset Option:** `AlertDialog` for "Reset to Defaults" confirmation.
*   [ ] **Microsite Preview (If Applicable):** Live preview panel alongside configuration.

---

## VII. CSS & Styling Architecture

### File Structure

```
src/
├── components/
│   └── ui/           # shadcn/ui components (copied, owned by you)
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ...
├── lib/
│   └── utils.ts      # cn() helper function
└── styles/
    └── globals.css   # CSS variables, base styles, @layer definitions
```

### Utility Function

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Installation Commands

```bash
# Initialize shadcn/ui (choose your framework)
npx shadcn@latest init

# Add components as needed
npx shadcn@latest add button card input dialog table tabs form toast avatar badge dropdown-menu sheet skeleton

# Install supporting libraries
npm install @tanstack/react-table zod react-hook-form sonner lucide-react
```

*   [ ] **Utility-First:** Tailwind CSS for all styling, design tokens in config.
*   [ ] **Design Tokens Integrated:** Colors, fonts, spacing, radii via CSS variables.
*   [ ] **Maintainability:** Components are copied (not node_modules), fully customizable.
*   [ ] **Performance:** Tailwind purges unused CSS; components are tree-shakeable.

---

## VIII. General Best Practices

*   [ ] **Iterative Design & Testing:** Continuously test with users and iterate on designs.
*   [ ] **Clear Information Architecture:** Organize content and navigation logically.
*   [ ] **Responsive Design:** Ensure the dashboard is fully functional on all device sizes:
    *   Desktop (1280px+): Full sidebar, multi-column layouts
    *   Tablet (768px-1279px): Collapsible sidebar, 2-column layouts
    *   Mobile (<768px): `Sheet` navigation, single-column, touch-friendly
*   [ ] **Documentation:** Maintain clear documentation for components and patterns.
*   [ ] **Performance Budgets:**
    *   First Contentful Paint: <1.5s
    *   Time to Interactive: <3s
    *   Bundle size: <200kb initial JS (gzipped)

---

## IX. Recommended Additions

### Data Visualization

*   **Charts:** `recharts` with shadcn/ui styling (see [shadcn/ui charts](https://ui.shadcn.com/charts))
*   **Metrics Cards:** `Card` with large numbers and trend indicators

### Advanced Patterns

*   **Command Palette:** `Command` (cmdk) for power user search (`Cmd+K`)
*   **Resizable Panels:** `ResizablePanelGroup` for customizable layouts
*   **Virtualization:** TanStack Virtual for large lists/tables
*   **Infinite Scroll:** Intersection Observer with `Skeleton` loading

### Authentication

*   **Login Forms:** `Form` + `Input` + `Button` with Zod validation
*   **User Menu:** `DropdownMenu` with `Avatar`, profile links, logout

---

## X. Quality Checklist

### Component Implementation
*   [ ] All components sourced from shadcn/ui where available
*   [ ] Components have all states: default, hover, active, focus, disabled
*   [ ] CSS variables configured in `globals.css`
*   [ ] Dark mode implemented with `next-themes` or similar

### Forms & Validation
*   [ ] Forms use React Hook Form + Zod schemas
*   [ ] Inline validation with `FormMessage`
*   [ ] Toast notifications via Sonner for success/error feedback

### Data Display
*   [ ] Tables use TanStack Table for sorting/filtering/pagination
*   [ ] Loading states use `Skeleton` components
*   [ ] Empty states with clear messaging and actions

### Accessibility
*   [ ] All interactive elements keyboard accessible
*   [ ] Focus states visible and consistent (`ring-2 ring-ring`)
*   [ ] ARIA labels on icon-only buttons
*   [ ] Color contrast meets WCAG AA (4.5:1)

### Performance
*   [ ] Icons from Lucide React (tree-shakeable)
*   [ ] Images optimized and lazy-loaded
*   [ ] Code splitting for routes
*   [ ] Mobile responsive with Tailwind breakpoints
