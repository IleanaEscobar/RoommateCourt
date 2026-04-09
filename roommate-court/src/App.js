import './App.css';
import * as React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage/LoginPage';
import SignUpPage from './components/SignUpPage/SignUpPage';
import Dashboard from './components/Dashboard/Dashboard';

function App() {
  return (
    <div className="App">
    <BrowserRouter>
      <main>
        <Routes>
          <Route
            path="/"
            element={(
              <LoginPage/>
            )}
          />
          <Route
            path="/sign-up"
            element={(
              <SignUpPage/>
            )}
          />
          <Route
            path="/dashboard/:uid"
            element={(
              <Dashboard/>
            )}
          />
        </Routes> 
      </main>
    </BrowserRouter>
  </div>
  );
}

export default App;