'use client';
// Add motion import at the top if not already present
import { motion } from 'framer-motion';
import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/ui/Navbar';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  Eye,
  EyeOff,
  Lock,
  Smartphone,
  Gift,
  Shield,
  Zap,
  Trophy,
  Sparkles
} from 'lucide-react';
import Footer from '@/components/ui/Footer';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isOtpLogin, setIsOtpLogin] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login, loginWithOtp } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      let user;
      if (isOtpLogin) {
        user = await loginWithOtp(phone, otp);
      } else {
        user = await login(phone, password);
      }

      if (user && user.role) {
        toast.success('Login successful! Redirecting...', {
          position: 'top-right',
          autoClose: 2000,
        });

        // Redirect based on user role
        if (user.role === 'spinner-user') {
          router.push('/spinner/dashboard');
        } else if (user.role === 'admin') {
          router.push('/admin');
        } else if (user.role === 'accountant') {
          router.push('/agent');
        } else if (user.role === 'agent') {
          router.push('/sub-agent');
        } else {
          router.push('/user/dashboard');
        }
      } else {
        setMessage('Login failed: User data is missing');
        toast.error('Login failed: User data is missing');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Login failed';
      setMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone) {
      setMessage('Please enter your phone number');
      toast.error('Please enter your phone number');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      if (response.ok) {
        setMessage('OTP sent to your phone');
        toast.success('OTP sent to your phone');
        setIsOtpLogin(true);
      } else {
        const error = await response.json();
        const errorMsg = error.message || 'Failed to send OTP';
        setMessage(errorMsg);
        toast.error(errorMsg);
      }
    } catch {
      const errorMsg = 'Failed to send OTP';
      setMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-blue-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8 pt-24">
        <div id="login-form" className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <motion.h1 
              className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              Welcome to Feta Spinner
            </motion.h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Sign in to your account and experience the thrill of winning with every spin!
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Login Form Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-full">
                  <Lock className="h-8 w-8 text-white" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                Sign In to Your Account
              </h2>

              {message && (
                <div
                  className={`mb-6 p-4 rounded-lg ${
                    message.includes('sent') || message.includes('success')
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {message}
                </div>
              )}

              <form className="space-y-6" onSubmit={handleLogin}>
                {/* Phone Number */}
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-gray-700 mb-2 flex items-center"
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Phone Number *
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                    placeholder="0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                {/* Password or OTP */}
                {!isOtpLogin ? (
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 pr-12"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="otp"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      OTP Code *
                    </label>
                    <input
                      id="otp"
                      name="otp"
                      type="text"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <Sparkles className="h-5 w-5 mr-2" />
                      Start Spinning
                    </span>
                  )}
                </button>
              </form>

              {/* Login Methods Toggle */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    if (isOtpLogin) {
                      setIsOtpLogin(false);
                    } else {
                      handleSendOtp();
                    }
                  }}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  disabled={isLoading}
                >
                  {isOtpLogin ? 'Use password instead' : 'Login with OTP'}
                </button>
              </div>

              {/* Register + Forgot Password */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <p className="text-center text-gray-600 text-sm">
                  Don't have an account?{' '}
                  <Link
                    href="/auth/register"
                    className="font-semibold text-blue-600 hover:text-blue-800 transition duration-200 hover:underline"
                  >
                    Create account
                  </Link>
                </p>
              </div>
              <div className="mt-4 text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-gray-500 hover:text-gray-700 transition duration-200 hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            {/* Features Section - Updated for Feta Spinner */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center mb-6">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg mr-3">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">
                    Why Choose Feta Spinner?
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {/* Exciting Spins */}
                  <div className="flex items-start">
                    <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-2 rounded-lg mr-4">
                      <Zap className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">
                        Exciting Spins
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Experience the thrill of spinning and winning amazing prizes every time
                      </p>
                    </div>
                  </div>

                  {/* Valuable Rewards */}
                  <div className="flex items-start">
                    <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-2 rounded-lg mr-4">
                      <Gift className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">
                        Valuable Rewards
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Win real items and instant prizes with every successful spin
                      </p>
                    </div>
                  </div>

                  {/* Secure Platform */}
                  <div className="flex items-start">
                    <div className="bg-gradient-to-r from-orange-100 to-red-100 p-2 rounded-lg mr-4">
                      <Shield className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">
                        Secure Platform
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Your spins and winnings are protected with advanced security measures
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Access */}
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Quick Access
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <Link
                    href="/spinner/spinnerlobby"
                    className="bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 p-4 rounded-xl text-center transition-all duration-200 transform hover:-translate-y-1"
                  >
                    <div className="font-bold text-lg mb-1">🎡</div>
                    <div className="font-semibold">Spin Now</div>
                    <div className="text-xs mt-1">Start Spinning</div>
                  </Link>
                  <Link
                    href="/howtoplay"
                    className="bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 text-purple-700 p-4 rounded-xl text-center transition-all duration-200 transform hover:-translate-y-1"
                  >
                    <div className="font-bold text-lg mb-1">📚</div>
                    <div className="font-semibold">Learn</div>
                    <div className="text-xs mt-1">How to Play</div>
                  </Link>
                </div>
              </div>

              {/* Daily Winners */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex items-center mb-4">
                  <Trophy className="h-6 w-6 mr-2" />
                  <h3 className="text-xl font-bold">Daily Winners</h3>
                </div>
                <p className="text-sm opacity-90 mb-4">
                  Join thousands of players who win amazing prizes every day!
                </p>
                <div className="flex justify-center">
                  <div className="bg-white/20 p-3 rounded-full">
                    <span className="text-2xl">🎉</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div className="mt-12 text-center">
            <p className="text-xs text-gray-500">
              By signing in, you agree to our{' '}
              <Link
                href="/termsofservice"
                className="text-blue-600 hover:underline"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacypolicy"
                className="text-blue-600 hover:underline"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

