import { render, screen } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';

test('renders login page on initial load', () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  const headingElement = screen.getByRole('heading', { name: /World Online Dart/i });
  expect(headingElement).toBeInTheDocument();
});