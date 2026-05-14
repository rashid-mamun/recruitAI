import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './index.css';

const THEME_KEY = 'recruit-ai-theme';
const storedTheme = localStorage.getItem(THEME_KEY);
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme =
    storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : systemPrefersDark
          ? 'dark'
          : 'light';

document.documentElement.dataset.theme = initialTheme;
localStorage.setItem(THEME_KEY, initialTheme);

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000, // Data fresh for 30s
            gcTime: 5 * 60_000, // Garbage collect after 5 min
            retry: 2,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    </React.StrictMode>,
);
