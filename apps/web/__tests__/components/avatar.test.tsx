import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Avatar } from '@/components/avatar';

describe('Avatar component', () => {
  it('renders image when src is provided', () => {
    render(<Avatar src="https://example.com/photo.jpg" name="Alice" />);
    const img = screen.getByAltText('Alice');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toContain('photo.jpg');
  });

  it('renders initials when src is null', () => {
    const { container } = render(<Avatar src={null} name="Bob Smith" />);
    expect(container.textContent).toBe('B');
  });

  it('falls back to initials on broken image URL', () => {
    render(<Avatar src="https://example.com/broken.jpg" name="Charlie" />);
    const img = screen.getByAltText('Charlie');
    fireEvent.error(img);
    // After error, initials should show
    expect(screen.queryByAltText('Charlie')).toBeNull();
    expect(screen.getByText('C')).toBeDefined();
  });

  it('applies correct size class', () => {
    const { container: sm } = render(<Avatar src={null} name="D" size="sm" />);
    expect((sm.firstChild as HTMLElement)?.className).toContain('h-8');

    const { container: lg } = render(<Avatar src={null} name="E" size="lg" />);
    expect((lg.firstChild as HTMLElement)?.className).toContain('h-20');
  });
});
