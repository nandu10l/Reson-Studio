import { HashRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import { ProjectProvider } from './contexts/ProjectContext';

import { GuideProvider } from './contexts/GuideContext';

function App() {
  return (
    <GuideProvider>
      <ProjectProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </HashRouter>
      </ProjectProvider>
    </GuideProvider>
  );
}

export default App;