import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import Create from './Create.tsx';
import { installMagnifier } from './magnifier.ts';
import { installTooltips } from './tooltip.ts';
import './styles.css';

installTooltips();
installMagnifier();
const teacher = /^\/create\/?$/.test(location.pathname);
document.title = teacher ? 'Communicator - Create' : document.title;
createRoot(document.getElementById('root')!).render(<StrictMode>{teacher ? <Create /> : <App />}</StrictMode>);
