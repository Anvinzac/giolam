import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import SalaryAdmin from "./pages/SalaryAdmin";
import SalaryEmployee from "./pages/SalaryEmployee";
import EmployeeSalaryEntry from "./pages/EmployeeSalaryEntry";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import TestTypeC from "./pages/TestTypeC";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/salary" element={<SalaryAdmin />} />
          <Route path="/salary" element={<SalaryEmployee />} />
          <Route path="/salary/edit" element={<EmployeeSalaryEntry />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/test" element={<TestTypeC />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
