import { Navigate, Route, Routes } from 'react-router-dom';

import SpaceDetailsPage from './pages/SpaceDetailsPage';
import SpaceIndexPage from './pages/SpaceIndexPage';

const SpaceRoutes = () => (
  <Routes>
    <Route index element={<SpaceIndexPage />} />
    <Route path="view/:permanentUrl" element={<SpaceDetailsPage />} />
    <Route path="*" element={<Navigate replace to="/" />} />
  </Routes>
);

export default SpaceRoutes;
