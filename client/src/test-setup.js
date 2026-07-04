import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Ensure each test starts with a clean DOM.
afterEach(() => {
  cleanup();
});
