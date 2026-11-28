import '@fontsource-variable/manrope';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AccountProvider } from './account/current';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider><App /></AccountProvider>
  </StrictMode>,
);
