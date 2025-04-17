import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  Users, 
  Building2, 
  Wallet, 
  ChevronRight, 
  ArrowLeft, 
  LogOut, 
  Clock,
  Upload,
  Image
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface SettingsGroup {
  title: string;
  items: {
    name: string;
    description: string;
    icon: any;
    path: string;
    roles?: string[];
  }[];
}

interface LogoSettings {
  url: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export function Settings() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [logoSettings, setLogoSettings] = useState<LogoSettings>({
    url: '',
    width: 40,
    height: 20,
    x: 20,
    y: 10
  });

  useEffect(() => {
    checkAccess();
    loadCurrentLogo();
    loadLogoSettings();
  }, [profile]);

  const checkAccess = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!profile?.role_id) {
        navigate('/dashboard');
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .single();

      if (roleError) throw roleError;

      if (!roleData || !['super_admin', 'admin'].includes(roleData.name)) {
        navigate('/dashboard');
        return;
      }

      setUserRole(roleData.name);
    } catch (err: any) {
      console.error('Error checking access:', err);
      setError('You do not have permission to access this page');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentLogo = async () => {
    try {
      const { data: settings, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'invoice_logo')
        .maybeSingle();

      if (error) throw error;
      
      if (settings?.value) {
        setCurrentLogo(settings.value);
      } else {
        setCurrentLogo(null);
      }
    } catch (error) {
      console.error('Error loading logo:', error);
      setCurrentLogo(null);
    }
  };

  const loadLogoSettings = async () => {
    try {
      const { data: settings, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'invoice_logo_settings')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (settings?.value) {
        setLogoSettings(JSON.parse(settings.value));
      }
    } catch (error) {
      console.error('Error loading logo settings:', error);
    }
  };

  const saveLogoSettings = async (newSettings: Partial<LogoSettings>) => {
    try {
      const updatedSettings = { ...logoSettings, ...newSettings };
      setLogoSettings(updatedSettings);

      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'invoice_logo_settings',
          value: JSON.stringify(updatedSettings)
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving logo settings:', error);
      setError('Failed to save logo settings');
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      setError(null);

      const fileExt = file.name.split('.').pop();
      const filePath = `invoice-logo-${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({ 
          key: 'invoice_logo',
          value: publicUrl
        });

      if (settingsError) throw settingsError;

      setCurrentLogo(publicUrl);
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      setError(error.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const settingsGroups: SettingsGroup[] = [
    {
      title: 'Business Settings',
      items: [
        {
          name: 'Facilities Management',
          description: 'Add, edit, and manage sports facilities',
          icon: Building2,
          path: '/settings/facilities',
          roles: ['super_admin', 'admin']
        },
        {
          name: 'Operating Hours',
          description: 'Set facility operating hours and availability',
          icon: Clock,
          path: '/settings/operating-hours',
          roles: ['super_admin']
        },
        {
          name: 'Payment Methods',
          description: 'Configure and manage payment accounts',
          icon: Wallet,
          path: '/bank-accounts',
          roles: ['super_admin']
        }
      ]
    },
    {
      title: 'User Management',
      items: [
        {
          name: 'User Accounts',
          description: 'Manage user roles and permissions',
          icon: Users,
          path: '/settings/users',
          roles: ['super_admin', 'admin']
        }
      ]
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <SettingsIcon className="h-8 w-8 text-indigo-600 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>

        <div className="space-y-6">
          {/* Invoice Logo Settings */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Invoice Settings</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Logo
                  </label>
                  {currentLogo && (
                    <div className="mb-4">
                      <img 
                        src={currentLogo} 
                        alt="Current Logo" 
                        className="h-16 object-contain rounded border border-gray-200"
                      />
                    </div>
                  )}
                  <div className="flex items-center space-x-4">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium ${
                        uploadingLogo 
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : 'text-gray-700 bg-white hover:bg-gray-50'
                      }`}>
                        <Upload className="h-5 w-5 mr-2" />
                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </div>
                    </label>
                    {currentLogo && (
                      <button
                        onClick={() => setCurrentLogo(null)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Recommended size: 200x100 pixels. Supported formats: PNG, JPG
                  </p>
                </div>

                {currentLogo && (
                  <div className="space-y-4 mt-6">
                    <h3 className="text-sm font-medium text-gray-900">Logo Settings</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Width (mm)
                        </label>
                        <input
                          type="number"
                          value={logoSettings.width}
                          onChange={(e) => saveLogoSettings({ width: Number(e.target.value) })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          min="10"
                          max="100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Height (mm)
                        </label>
                        <input
                          type="number"
                          value={logoSettings.height}
                          onChange={(e) => saveLogoSettings({ height: Number(e.target.value) })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          min="10"
                          max="100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          X Position (mm)
                        </label>
                        <input
                          type="number"
                          value={logoSettings.x}
                          onChange={(e) => saveLogoSettings({ x: Number(e.target.value) })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          min="0"
                          max="190"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Y Position (mm)
                        </label>
                        <input
                          type="number"
                          value={logoSettings.y}
                          onChange={(e) => saveLogoSettings({ y: Number(e.target.value) })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          min="0"
                          max="270"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Other Settings Groups */}
          {settingsGroups.map((group, index) => {
            const accessibleItems = group.items.filter(
              item => !item.roles || (userRole && item.roles.includes(userRole))
            );

            if (accessibleItems.length === 0) return null;

            return (
              <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">{group.title}</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {accessibleItems.map((item, itemIndex) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={itemIndex}
                        to={item.path}
                        className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors duration-200"
                      >
                        <div className="flex items-center">
                          <Icon className="h-6 w-6 text-indigo-600" />
                          <div className="ml-4">
                            <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
                            <p className="text-sm text-gray-500">{item.description}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Account Actions */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Account</h2>
            </div>
            <div>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center p-6 hover:bg-red-50 transition-colors duration-200 text-left"
              >
                <LogOut className="h-6 w-6 text-red-600" />
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-red-600">Sign Out</h3>
                  <p className="text-sm text-red-500">Sign out of your account</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Sign Out</h3>
            <p className="text-gray-500 mb-6">
              Are you sure you want to sign out? You will need to sign in again to access your account.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}