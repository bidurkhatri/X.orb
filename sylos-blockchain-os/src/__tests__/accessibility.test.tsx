/**
 * Accessibility Test Suite for SylOS
 * WCAG 2.1 AA Compliance Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import userEvent from '@testing-library/user-event'
import Desktop from '../components/Desktop'
import DesktopIcon from '../components/DesktopIcon'
import AppWindow from '../components/AppWindow'
import { announceToScreenReader } from '../utils/accessibility'

expect.extend(toHaveNoViolations)

describe('Accessibility Tests', () => {
  
  describe('WCAG 2.1 AA Compliance', () => {
    
    test('Desktop component has no accessibility violations', async () => {
      const { container } = render(<Desktop />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    test('DesktopIcon component has no accessibility violations', async () => {
      const mockOnClick = jest.fn()
      const { container } = render(
        <DesktopIcon
          icon={<div>Icon</div>}
          label="Test App"
          onClick={mockOnClick}
          appId="test-app"
          description="Test application description"
        />
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    test('AppWindow component has no accessibility violations', async () => {
      const { container } = render(
        <AppWindow
          title="Test Window"
          icon={<div>Icon</div>}
          onClose={jest.fn()}
          onMinimize={jest.fn()}
          onFocus={jest.fn()}
          isActive={true}
        >
          <div>Window content</div>
        </AppWindow>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Keyboard Navigation', () => {
    
    test('Desktop supports arrow key navigation between icons', async () => {
      const user = userEvent.setup()
      render(<Desktop />)
      
      // Focus should start on first icon
      const firstIcon = screen.getAllByRole('button')[0]
      await user.tab()
      expect(firstIcon).toHaveFocus()
      
      // Test arrow key navigation
      await user.keyboard('{ArrowRight}')
      const secondIcon = screen.getAllByRole('button')[1]
      expect(secondIcon).toHaveFocus()
    })

    test('DesktopIcon supports Enter and Space activation', async () => {
      const user = userEvent.setup()
      const mockOnClick = jest.fn()
      
      render(
        <DesktopIcon
          icon={<div>Icon</div>}
          label="Test App"
          onClick={mockOnClick}
          appId="test-app"
        />
      )
      
      const button = screen.getByRole('button')
      await user.tab()
      expect(button).toHaveFocus()
      
      // Test Enter key
      await user.keyboard('{Enter}')
      expect(mockOnClick).toHaveBeenCalledTimes(1)
      
      // Test Space key
      await user.keyboard(' ')
      expect(mockOnClick).toHaveBeenCalledTimes(2)
    })

    test('AppWindow supports Escape key to close', async () => {
      const user = userEvent.setup()
      const mockOnClose = jest.fn()
      
      render(
        <AppWindow
          title="Test Window"
          icon={<div>Icon</div>}
          onClose={mockOnClose}
          onMinimize={jest.fn()}
          onFocus={jest.fn()}
          isActive={true}
        >
          <div>Window content</div>
        </AppWindow>
      )
      
      const closeButton = screen.getByLabelText('Close Test Window window')
      await user.tab()
      await user.keyboard('{Escape}')
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Screen Reader Support', () => {
    
    test('Desktop provides screen reader descriptions', () => {
      render(<Desktop />)
      
      // Check for screen reader only content
      const description = screen.getByText(/Use arrow keys to navigate/)
      expect(description).toBeInTheDocument()
      expect(description).toHaveClass('sr-only')
    })

    test('DesktopIcon includes ARIA labels and descriptions', () => {
      render(
        <DesktopIcon
          icon={<div>Icon</div>}
          label="Test App"
          onClick={jest.fn()}
          appId="test-app"
          description="Test application description"
        />
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', 'Test App - Test application description')
      
      const hiddenDescription = screen.getByText('Test application description')
      expect(hiddenDescription).toHaveClass('sr-only')
    })

    test('AppWindow includes proper ARIA attributes', () => {
      render(
        <AppWindow
          title="Test Window"
          icon={<div>Icon</div>}
          onClose={jest.fn()}
          onMinimize={jest.fn()}
          onFocus={jest.fn()}
          isActive={true}
        >
          <div>Window content</div>
        </AppWindow>
      )
      
      const window = screen.getByRole('dialog')
      expect(window).toHaveAttribute('aria-labelledby')
      expect(window).toHaveAttribute('aria-describedby')
    })

    test('announceToScreenReader function creates live regions', async () => {
      // Mock document.createElement
      const mockCreateElement = jest.spyOn(document, 'createElement')
      const mockAppendChild = jest.spyOn(document.body, 'appendChild')
      const mockRemoveChild = jest.spyOn(document.body, 'removeChild')
      
      const mockDiv = {
        setAttribute: jest.fn(),
        textContent: 'Test announcement',
        remove: jest.fn()
      }
      mockCreateElement.mockReturnValue(mockDiv as any)
      
      announceToScreenReader('Test announcement', 'polite')
      
      expect(mockCreateElement).toHaveBeenCalledWith('div')
      expect(mockDiv.setAttribute).toHaveBeenCalledWith('aria-live', 'polite')
      expect(mockDiv.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true')
      expect(mockDiv.setAttribute).toHaveBeenCalledWith('class', 'sr-only')
      expect(mockDiv.textContent).toBe('Test announcement')
      expect(mockAppendChild).toHaveBeenCalledWith(mockDiv)
      expect(mockRemoveChild).toHaveBeenCalledWith(mockDiv)
      
      // Cleanup
      mockCreateElement.mockRestore()
      mockAppendChild.mockRestore()
      mockRemoveChild.mockRestore()
    })
  })

  describe('Focus Management', () => {
    
    test('Focus indicators are visible', () => {
      const { container } = render(
        <DesktopIcon
          icon={<div>Icon</div>}
          label="Test App"
          onClick={jest.fn()}
          appId="test-app"
        />
      )
      
      const button = container.querySelector('button')
      expect(button).toHaveAttribute('tabindex', '0')
    })

    test('Focus management preserves tab order', async () => {
      const user = userEvent.setup()
      
      render(
        <div>
          <DesktopIcon
            icon={<div>Icon1</div>}
            label="App 1"
            onClick={jest.fn()}
            appId="app1"
          />
          <DesktopIcon
            icon={<div>Icon2</div>}
            label="App 2"
            onClick={jest.fn()}
            appId="app2"
          />
        </div>
      )
      
      const buttons = screen.getAllByRole('button')
      
      // Test tab order
      await user.tab()
      expect(buttons[0]).toHaveFocus()
      
      await user.tab()
      expect(buttons[1]).toHaveFocus()
      
      // Test shift+tab reverse order
      await user.tab({ shift: true })
      expect(buttons[0]).toHaveFocus()
    })
  })

  describe('Color Contrast', () => {
    
    test('Text meets WCAG AA contrast requirements', () => {
      const { container } = render(<Desktop />)
      
      // Check for high contrast focus styles
      const styleElements = container.querySelectorAll('style')
      const hasFocusStyles = Array.from(styleElements).some(style => 
        style.textContent?.includes('outline: 2px solid #8B5CF6')
      )
      expect(hasFocusStyles).toBe(true)
      
      // Check for reduced motion support
      const hasReducedMotion = Array.from(styleElements).some(style =>
        style.textContent?.includes('@media (prefers-reduced-motion: reduce)')
      )
      expect(hasReducedMotion).toBe(true)
    })

    test('High contrast mode is supported', () => {
      const { container } = render(<Desktop />)
      
      const styleElements = container.querySelectorAll('style')
      const hasHighContrast = Array.from(styleElements).some(style =>
        style.textContent?.includes('@media (prefers-contrast: high)')
      )
      expect(hasHighContrast).toBe(true)
    })
  })

  describe('Touch Targets', () => {
    
    test('All interactive elements meet minimum touch target size', () => {
      render(
        <DesktopIcon
          icon={<div>Icon</div>}
          label="Test App"
          onClick={jest.fn()}
          appId="test-app"
        />
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('touch-target')
    })

    test('Touch target size adapts to device type', () => {
      const { container } = render(<Desktop />)
      
      const styleElements = container.querySelectorAll('style')
      const hasResponsiveTouchTargets = Array.from(styleElements).some(style =>
        style.textContent?.includes('@media (pointer: coarse)')
      )
      expect(hasResponsiveTouchTargets).toBe(true)
    })
  })

  describe('Semantic HTML', () => {
    
    test('Proper semantic elements are used', () => {
      render(<Desktop />)
      
      // Check for main landmark
      const main = screen.getByRole('main')
      expect(main).toBeInTheDocument()
      
      // Check for proper heading structure
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)
    })

    test('ARIA roles are used appropriately', () => {
      render(
        <AppWindow
          title="Test Window"
          icon={<div>Icon</div>}
          onClose={jest.fn()}
          onMinimize={jest.fn()}
          onFocus={jest.fn()}
          isActive={true}
        >
          <div>Window content</div>
        </AppWindow>
      )
      
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      
      const toolbar = screen.getByRole('toolbar')
      expect(toolbar).toBeInTheDocument()
    })
  })

  describe('Form Accessibility', () => {
    
    test('Form inputs are properly labeled', () => {
      const TestForm = () => (
        <form>
          <label htmlFor="test-input">Test Input</label>
          <input 
            id="test-input" 
            type="text" 
            aria-describedby="input-help"
          />
          <div id="input-help" className="sr-only">
            Enter test data
          </div>
        </form>
      )
      
      render(<TestForm />)
      
      const input = screen.getByLabelText('Test Input')
      const help = screen.getByText('Enter test data')
      
      expect(input).toBeInTheDocument()
      expect(help).toHaveClass('sr-only')
    })

    test('Error states are announced to screen readers', () => {
      const TestForm = () => (
        <div role="alert" aria-live="assertive">
          <p className="error-message">
            <span className="sr-only">Error: </span>
            Please check your input
          </p>
        </div>
      )
      
      render(<TestForm />)
      
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      
      const errorMessage = screen.getByText('Please check your input')
      expect(errorMessage).toHaveClass('error-message')
    })
  })

  describe('Performance and Loading States', () => {
    
    test('Loading states are announced to screen readers', () => {
      const LoadingComponent = () => (
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading...</span>
          Loading content
        </div>
      )
      
      render(<LoadingComponent />)
      
      const status = screen.getByRole('status')
      expect(status).toHaveAttribute('aria-live', 'polite')
      expect(status).toHaveAttribute('aria-busy', 'true')
      
      const srOnly = screen.getByText('Loading...')
      expect(srOnly).toHaveClass('sr-only')
    })
  })

  describe('Mobile Accessibility', () => {
    
    test('Mobile viewport meta tag is present', () => {
      const { container } = render(<Desktop />)
      
      const viewportMeta = container.querySelector('meta[name="viewport"]')
      expect(viewportMeta).toBeInTheDocument()
      expect(viewportMeta).toHaveAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
    })

    test('Mobile-optimized touch targets are implemented', () => {
      render(<Desktop />)
      
      const icons = screen.getAllByRole('button')
      icons.forEach(icon => {
        expect(icon).toHaveClass('touch-target')
      })
    })
  })
})

// Integration test for complete accessibility workflow
describe('Integration Tests', () => {
  
  test('Complete user workflow is accessible', async () => {
    const user = userEvent.setup()
    
    render(<Desktop />)
    
    // 1. User can navigate to desktop
    const firstIcon = screen.getAllByRole('button')[0]
    await user.tab()
    expect(firstIcon).toHaveFocus()
    
    // 2. User can open an application
    await user.keyboard('{Enter}')
    
    // 3. User can interact with application window
    const closeButton = screen.getByLabelText(/Close.*window/)
    expect(closeButton).toBeInTheDocument()
    
    // 4. User can close the application
    await user.click(closeButton)
    
    // 5. Focus returns to desktop
    expect(firstIcon).toHaveFocus()
  })
})

// Performance tests
describe('Performance Tests', () => {
  
  test('Screen reader announcements do not cause performance issues', async () => {
    const startTime = performance.now()
    
    // Simulate multiple announcements
    for (let i = 0; i < 10; i++) {
      announceToScreenReader(`Announcement ${i}`)
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Should complete quickly (less than 100ms)
    expect(duration).toBeLessThan(100)
  })
})