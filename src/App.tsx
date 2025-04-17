import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';
import { UserManagement } from './pages/UserManagement';
import { Facilities } from './pages/Facilities';
import { Home } from './pages/Home';
import { BankAccounts } from './pages/BankAccounts';
import { OperatingHours } from './pages/OperatingHours';
import { PaymentBooking } from './pages/PaymentBooking';
import { MyBookings } from './pages/MyBookings';
import { GuestBooking } from './pages/GuestBooking';
import { CreateBooking } from './pages/CreateBooking';
import { EditBooking } from './pages/EditBooking';
import { AuthGuard } from './components/AuthGuard';
import { RoleGuard } from './components/RoleGuard';
import MyProfile from './pages/MyProfile';

function App() {
  return (
    <Router future={{ v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/payment" element={<PaymentBooking />} />
        <Route path="/my-profile" element={<AuthGuard><MyProfile /></AuthGuard>} />

        <Route path="/guest-booking" element={<GuestBooking />} />
        
        <Route
          path="/my-bookings"
          element={
            <AuthGuard>
              <MyBookings />
            </AuthGuard>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <RoleGuard allowedRoles={['super_admin', 'admin','staff']}>
                <Dashboard />
              </RoleGuard>
            </AuthGuard>
          }
        />
        <Route
          path="/create-booking"
          element={
            <AuthGuard>
              <CreateBooking />
            </AuthGuard>
          }
        />
        <Route
          path="/edit-booking/:id"
          element={
            <AuthGuard>
              <RoleGuard allowedRoles={['super_admin', 'admin', 'staff']}>
                <EditBooking />
              </RoleGuard>
            </AuthGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <AuthGuard>
              <RoleGuard allowedRoles={['super_admin', 'admin','staff']}>
                <Settings />
              </RoleGuard>
            </AuthGuard>
          }
        />
        <Route
          path="/settings/users"
          element={
            <AuthGuard>
              <RoleGuard allowedRoles={['super_admin', 'admin']}>
                <UserManagement />
              </RoleGuard>
            </AuthGuard>
          }
        />
        <Route
          path="/settings/facilities"
          element={
            <AuthGuard>
              <RoleGuard allowedRoles={['super_admin', 'admin']}>
                <Facilities />
              </RoleGuard>
            </AuthGuard>
          }
        />
        <Route
          path="/settings/operating-hours"
          element={
            <AuthGuard>
              <RoleGuard allowedRoles={['super_admin']}>
                <OperatingHours />
              </RoleGuard>
            </AuthGuard>
          }
        />
        <Route
          path="/bank-accounts"
          element={
            <AuthGuard>
              <RoleGuard allowedRoles={['super_admin']}>
                <BankAccounts />
              </RoleGuard>
            </AuthGuard>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;