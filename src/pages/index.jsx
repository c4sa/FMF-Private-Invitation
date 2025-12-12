import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Attendees from "./Attendees";

import Registration from "./Registration";

import SystemUsers from "./SystemUsers";

import Settings from "./Settings";

import PublicRegistration from "./PublicRegistration";

import ProfileSetup from "./ProfileSetup";

import UsersList from "./UsersList";

import PartnershipManagement from "./PartnershipManagement";

import Analytics from "./Analytics";

import Requests from "./Requests";

import AnalyticsDashboard from "./AnalyticsDashboard";

import AccessLevels from "./AccessLevels";

import PrivateInvitations from "./PrivateInvitations";

import Trophy from "./Trophy";

import Certificate from "./Certificate";

import TestDataSetup from "./TestDataSetup";

import Login from "./Login";
import Signup from "./Signup";
import ResetPassword from "./ResetPassword";
import VerifyOtp from "./VerifyOtp";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Attendees: Attendees,
    
    Registration: Registration,
    
    SystemUsers: SystemUsers,
    
    Settings: Settings,
    
    PublicRegistration: PublicRegistration,
    
    ProfileSetup: ProfileSetup,
    
    UsersList: UsersList,
    
    PartnershipManagement: PartnershipManagement,
    
    Analytics: Analytics,
    
    Requests: Requests,
    
    AnalyticsDashboard: AnalyticsDashboard,
    
    AccessLevels: AccessLevels,
    
    PrivateInvitations: PrivateInvitations,
    
    Trophy: Trophy,
    
    Certificate: Certificate,
    
    TestDataSetup: TestDataSetup,
    
    Login: Login,
    
    Signup: Signup,
    
    ResetPassword: ResetPassword,
    
    VerifyOtp: VerifyOtp,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    // Convert kebab-case to camelCase for matching
    const camelCaseUrl = urlLastPart.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    
    const pageName = Object.keys(PAGES).find(page => 
        page.toLowerCase() === urlLastPart.toLowerCase() || 
        page.toLowerCase() === camelCaseUrl.toLowerCase()
    );
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Attendees" element={<Attendees />} />
                
                <Route path="/Registration" element={<Registration />} />
                
                <Route path="/SystemUsers" element={<SystemUsers />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/PublicRegistration" element={<PublicRegistration />} />
                
                <Route path="/ProfileSetup" element={<ProfileSetup />} />
                
                <Route path="/UsersList" element={<UsersList />} />
                
                <Route path="/PartnershipManagement" element={<PartnershipManagement />} />
                
                <Route path="/Analytics" element={<Analytics />} />
                
                <Route path="/Requests" element={<Requests />} />
                
                <Route path="/AnalyticsDashboard" element={<AnalyticsDashboard />} />
                
                <Route path="/AccessLevels" element={<AccessLevels />} />
                
                <Route path="/PrivateInvitations" element={<PrivateInvitations />} />
                
                <Route path="/Trophy" element={<Trophy />} />
                
                <Route path="/Certificate" element={<Certificate />} />
                
                <Route path="/TestDataSetup" element={<TestDataSetup />} />
                
                <Route path="/login" element={<Login />} />
                
                <Route path="/signup" element={<Signup />} />
                
                <Route path="/reset-password" element={<ResetPassword />} />
                
                <Route path="/verify-otp" element={<VerifyOtp />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}