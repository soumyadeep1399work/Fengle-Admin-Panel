import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Restaurants from './pages/Restaurants';
import RestaurantDetail from './pages/RestaurantDetail';
import Riders from './pages/Riders';
import RiderDetail from './pages/RiderDetail';
import Settlements from './pages/Settlements';
import Categories from './pages/Categories';
import Items from './pages/Items';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Campaigns from './pages/Campaigns';
import Coupons from './pages/Coupons';

export default function App() {
  const { admin, booting } = useAuth();
  if (booting) return <Spinner />;
  if (!admin) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="restaurants/:id" element={<RestaurantDetail />} />
        <Route path="riders" element={<Riders />} />
        <Route path="riders/:id" element={<RiderDetail />} />
        <Route path="settlements" element={<Settlements />} />
        <Route path="categories" element={<Categories />} />
        <Route path="items" element={<Items />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
