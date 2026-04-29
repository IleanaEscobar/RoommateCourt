import './App.css';
import * as React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login/Login';
import SignUp from './pages/SignUp/SignUp';
import Dashboard from './pages/Dashboard/Dashboard';
import CaseSubmission from './pages/CaseSubmission/CaseSubmission';
import CaseReview from './pages/CaseReview/CaseReview';
import WaitingRoom from './pages/WaitingRoom/WaitingRoom';
import OpenFloor from './pages/OpenFloor/OpenFloor';
import JuryVoting from './pages/JuryVoting/JuryVoting';

function App() {
  return (
    <div className="App">
    <BrowserRouter>
      <main>
        <Routes>
          <Route path="/" element={(<Login/>)} />
          <Route path="/sign-up" element={(<SignUp/>)} />
          <Route path="/dashboard/:uid" element={(<Dashboard/>)} />
          <Route path="/dashboard/:uid/case-submission/:severity" element={(<CaseSubmission/>)} />
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