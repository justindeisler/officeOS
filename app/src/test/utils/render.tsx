import { render, RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactElement, ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'

interface WrapperProps {
  children: ReactNode
}

/**
 * All providers wrapper for testing
 * Add additional providers here as needed (e.g., ThemeProvider, QueryClientProvider)
 */
function AllProviders({ children }: WrapperProps) {
  return <BrowserRouter>{children}</BrowserRouter>
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string
}

/**
 * Custom render function that wraps components with all necessary providers
 * and sets up userEvent for simulating user interactions
 *
 * @example
 * const { user } = render(<MyComponent />)
 * await user.click(screen.getByRole('button'))
 */
function customRender(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { route = '/', ...renderOptions } = options

  // Set the initial route if needed
  window.history.pushState({}, 'Test page', route)

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllProviders, ...renderOptions }),
  }
}

// Re-export everything from testing-library
export * from '@testing-library/react'

// Override render with our custom version
export { customRender as render }
