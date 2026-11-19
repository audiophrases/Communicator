import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { installMagnifier } from './magnifier.ts';
import { installTooltips } from './tooltip.ts';
import './styles.css';

installTooltips();
installMagnifier();
const teacher = /^\/create\/?$/.test(location.pathname);
document.title = teacher ? 'Communicator - Create' : document.title;
const root = createRoot(document.getElementById('root')!);
if (teacher) {
    void import('./Create.tsx').then(({ default: Create }) => root.render(<StrictMode><Create /></StrictMode>));
} else {
    root.render(<StrictMode><App /></StrictMode>);
}
