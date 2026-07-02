import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Note: we intentionally do NOT wrap the app in <React.StrictMode>. Strict mode
// mounts every component twice in development, which forces CesiumJS to build,
// tear down and rebuild the WebGL globe on each change — wasteful and a source
// of flicker for a heavyweight 3D component. The rest of the app is side-effect
// clean, so we lose nothing meaningful here.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
