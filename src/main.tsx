import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App'; // Assuming your main App component is in App.tsx
import './index.css'; // Assuming your global styles are here

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} /> {/* Basic route for the home page */}
        {/* Add more routes here as you migrate your pages */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);