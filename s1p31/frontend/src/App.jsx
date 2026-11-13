import { useHashRoute } from './hooks/useHashRoute.js';
import { useContract } from './hooks/useContract.js';
import { TerminologyProvider } from './context/TerminologyContext.jsx';
import { FormatProvider } from './context/FormatContext.jsx';
import { ExplorerProvider } from './context/ExplorerContext.jsx';
import { Sidebar } from './components/shared/Sidebar.jsx';
import { Header } from './components/shared/Header.jsx';
import { ErrorBoundary } from './components/shared/ErrorBoundary.jsx';
import { Dashboard, PAGE_IDS, DEFAULT_PAGE } from './pages/Dashboard.jsx';

function Shell() {
  const route = useHashRoute(PAGE_IDS, DEFAULT_PAGE);
  const contract = useContract();
  return (
    <div className="app">
      <Sidebar route={route} />
      <div className="main">
        <Header />
        {contract.error ? (
          <div className="banner" role="status">
            The data contract could not be read, so default file locations are being used. {contract.error.message}
          </div>
        ) : null}
        <main className="content">
          <ErrorBoundary key={route} label="this page">
            <Dashboard route={route} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <TerminologyProvider>
      <FormatProvider>
        <ExplorerProvider>
          <Shell />
        </ExplorerProvider>
      </FormatProvider>
    </TerminologyProvider>
  );
}
