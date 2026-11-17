import { DemoModeProvider } from './context/DemoModeContext';
import { ThemeProvider } from './context/ThemeContext';
import { LandingPage } from './pages/LandingPage';

export default function App() {
  return (
    <ThemeProvider>
      <DemoModeProvider>
        <LandingPage />
      </DemoModeProvider>
    </ThemeProvider>
  );
}
