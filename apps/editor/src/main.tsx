import { createRoot } from 'react-dom/client';
import EditorPage from './editor/EditorPage';
import './style.css';
document.body.className = 'min-h-dvh font-sans text-ink antialiased';
createRoot(document.getElementById('app')!).render(<EditorPage />);
