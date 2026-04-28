import './App.css';
import * as React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage/LoginPage';
import SignUpPage from './components/SignUpPage/SignUpPage';
import Dashboard from './components/Dashboard/Dashboard';
import CaseSubmissionPage from './components/CaseSubmissionPage/CaseSubmissionPage';
import CaseReview from './components/CaseReview/CaseReview';
import WaitingRoom from './components/WaitingRoom/WaitingRoom';
import OpenFloor from './components/OpenFloor/OpenFloor';
import JuryVoting from './components/JuryVoting/JuryVoting';

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
          <Route
            path="/dashboard/:uid/case-submission/:severity"
            element={(
              <CaseSubmissionPage/>
            )}
          />
          <Route path="/case/new" element={<CaseReview/>} />
          <Route path="/case/:caseId/review" element={<CaseReview/>} />
          <Route path="/case/:caseId/waiting" element={<WaitingRoom/>} />
          <Route path="/case/:caseId/floor" element={<OpenFloor/>} />
          <Route path="/case/:caseId/voting" element={<JuryVoting/>} />
        </Routes>
      </main>
    </BrowserRouter>
  </div>
  );
}

export default App;