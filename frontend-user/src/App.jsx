import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import MyComplaints from './pages/MyComplaints';
import AreaComplaints from './pages/AreaComplaints';
import ResolvedIssues from './pages/ResolvedIssues';
import Profile from './pages/Profile';
import Layout from './components/Layout';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Home />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-complaints"
            element={
              <ProtectedRoute>
                <Layout>
                  <MyComplaints />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/area-complaints"
            element={
              <ProtectedRoute>
                <Layout>
                  <AreaComplaints />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/resolved-issues"
            element={
              <ProtectedRoute>
                <Layout>
                  <ResolvedIssues />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout>
                  <Profile />
                </Layout>
              </ProtectedRoute>
            }
          />
          {/* We will add more routes here in next phases */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
