import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, useCan } from './auth';
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
import Admins from './pages/Admins';
import Documents from './pages/Documents';
import Shipping from './pages/Shipping';
import CodCash from './pages/CodCash';
import Finance from './pages/Finance';
import Notifications from './pages/Notifications';
import RestaurantSettlements, { RestaurantStatementPage } from './pages/RestaurantSettlements';
import ProductProfit from './pages/ProductProfit';

export default function App() {
  const { admin, booting } = useAuth();
  const can = useCan();
  if (booting) return <Spinner />;
  if (!admin) return <Login />;
  const home = <Navigate to="/" replace />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="restaurants" element={<Restaurants />} />
        <Route path="restaurants/:id" element={<RestaurantDetail />} />
        <Route path="restaurants/:id/settlement" element={can('manage') ? <RestaurantStatementPage /> : home} />
        <Route path="restaurant-settlements" element={can('manage') ? <RestaurantSettlements /> : home} />
        <Route path="riders" element={<Riders />} />
        <Route path="riders/:id" element={<RiderDetail />} />
        <Route path="settlements" element={<Settlements />} />
        <Route path="documents" element={<Documents />} />
        <Route path="rider-pay" element={<Navigate to="/shipping" replace />} />
        <Route path="shipping" element={<Shipping />} />
        <Route path="cod" element={<CodCash />} />
        <Route path="finance" element={can('money') ? <Finance /> : home} />
        <Route path="profit-per-dish" element={can('money') ? <ProductProfit /> : home} />
        <Route path="categories" element={<Categories />} />
        <Route path="items" element={<Items />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="campaigns" element={can('money') ? <Campaigns /> : home} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="notifications" element={can('money') ? <Notifications /> : home} />
        <Route path="admins" element={can('admins') ? <Admins /> : home} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
