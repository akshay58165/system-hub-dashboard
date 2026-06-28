import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CloudProvider } from './cloud.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CloudProvider><App /></CloudProvider>
  </StrictMode>,
);
