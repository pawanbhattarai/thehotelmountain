import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Calendar, BarChart3 } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-xl mb-6 shadow-lg">
            <Building2 className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            HotelPro PMS
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Comprehensive Property Management System for modern hotels with multi-branch support and role-based access control
          </p>
          <Button 
            onClick={handleLogin}
            size="lg"
            className="bg-white text-primary hover:bg-gray-100 text-lg px-8 py-3"
          >
            Sign In to Get Started
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Calendar className="h-8 w-8 text-white mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Multi-Room Reservations
              </h3>
              <p className="text-blue-100 text-sm">
                Book multiple rooms with different check-in/out dates in one reservation
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Building2 className="h-8 w-8 text-white mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Multi-Branch Support
              </h3>
              <p className="text-blue-100 text-sm">
                Manage multiple hotel locations with centralized oversight
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 text-white mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Role-Based Access
              </h3>
              <p className="text-blue-100 text-sm">
                Superadmin and Branch Admin roles with appropriate permissions
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <BarChart3 className="h-8 w-8 text-white mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Real-time Analytics
              </h3>
              <p className="text-blue-100 text-sm">
                Live dashboard with occupancy rates, revenue, and operational metrics
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
