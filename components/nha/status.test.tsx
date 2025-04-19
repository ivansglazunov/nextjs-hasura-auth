import React from 'react';
import { render, screen } from '@testing-library/react';
import { Status } from './status';

describe('Status component', () => {
  test('renders connecting status by default', () => {
    render(<Status />);
    expect(screen.getByText('Connecting')).toBeInTheDocument();
  });

  test('renders connected status', () => {
    render(<Status status="connected" />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  test('renders error status', () => {
    render(<Status status="error" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  test('renders connecting status when specified', () => {
    render(<Status status="connecting" />);
    expect(screen.getByText('Connecting')).toBeInTheDocument();
  });

  test('renders custom label when provided', () => {
    render(<Status status="connected" label="Custom Label" />);
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });
}); 