/**
 * Example test file to verify TDD setup works correctly.
 * This file can be deleted once you've confirmed the setup is working.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from './utils'
import { createMockTask, createMockClient, createMockProject } from './mocks'

// Simple component for testing
function TestComponent({ message }: { message: string }) {
  return (
    <div>
      <h1>Test Component</h1>
      <p data-testid="message">{message}</p>
      <button onClick={() => {}}>Click me</button>
    </div>
  )
}

describe('TDD Setup Verification', () => {
  describe('Component Rendering', () => {
    it('renders a component correctly', () => {
      render(<TestComponent message="Hello, TDD!" />)

      expect(screen.getByRole('heading')).toHaveTextContent('Test Component')
      expect(screen.getByTestId('message')).toHaveTextContent('Hello, TDD!')
    })

    it('can find elements by role', () => {
      render(<TestComponent message="Test" />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('supports user interactions', async () => {
      const { user } = render(<TestComponent message="Test" />)

      const button = screen.getByRole('button')
      await user.click(button)

      // Button should still be in the document after click
      expect(button).toBeInTheDocument()
    })
  })

  describe('Mock Data Factories', () => {
    it('creates a mock task with defaults', () => {
      const task = createMockTask()

      expect(task.id).toBeDefined()
      expect(task.title).toBe('Test Task')
      expect(task.status).toBe('backlog')
      expect(task.priority).toBe(2)
    })

    it('creates a mock task with overrides', () => {
      const task = createMockTask({
        title: 'Custom Task',
        status: 'in_progress',
        priority: 1,
      })

      expect(task.title).toBe('Custom Task')
      expect(task.status).toBe('in_progress')
      expect(task.priority).toBe(1)
    })

    it('creates a mock client', () => {
      const client = createMockClient({ name: 'Acme Corp' })

      expect(client.name).toBe('Acme Corp')
      expect(client.status).toBe('active')
      expect(client.email).toBeDefined()
    })

    it('creates a mock project', () => {
      const project = createMockProject({ status: 'completed' })

      expect(project.status).toBe('completed')
      expect(project.area).toBe('freelance')
    })
  })

  describe('Vitest Features', () => {
    it('supports vi.fn() for mocking functions', () => {
      const mockFn = vi.fn()

      mockFn('arg1', 'arg2')

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('supports vi.spyOn() for spying on methods', () => {
      const obj = {
        method: () => 'original',
      }

      const spy = vi.spyOn(obj, 'method').mockReturnValue('mocked')

      expect(obj.method()).toBe('mocked')
      expect(spy).toHaveBeenCalled()
    })

    it('supports async/await', async () => {
      const asyncFn = async () => 'resolved'

      const result = await asyncFn()

      expect(result).toBe('resolved')
    })
  })
})

describe('jest-dom Matchers', () => {
  it('supports toBeInTheDocument()', () => {
    render(<TestComponent message="Test" />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('supports toHaveTextContent()', () => {
    render(<TestComponent message="Hello World" />)
    expect(screen.getByTestId('message')).toHaveTextContent('Hello World')
  })

  it('supports toBeVisible()', () => {
    render(<TestComponent message="Visible content" />)
    expect(screen.getByRole('button')).toBeVisible()
  })
})
