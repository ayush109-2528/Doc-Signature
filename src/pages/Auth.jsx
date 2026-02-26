import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Mail, Lock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function Auth() {
  const [view, setView] = useState('signin') // 'signin', 'signup', 'forgot'
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const navigate = useNavigate()

  // Form States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (view === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/')
      } 
      else if (view === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage({ type: 'success', text: 'Check your email to confirm account!' })
      } 
      else if (view === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setMessage({ type: 'success', text: 'Password reset link sent!' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc]">
      {/* Left Side - Creative Visual */}
      <div className="hidden lg:flex w-1/2 bg-blue-600 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="z-10 text-white text-center px-12">
          <h1 className="text-5xl font-bold mb-6">Digital Trust.</h1>
          <p className="text-xl text-blue-100 font-light">
            Secure, legally binding document signing for the modern web.
            Join thousands of users simplifying their workflow today.
          </p>
        </div>
        {/* Animated Circle */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
          
          {/* Header */}
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800">
              {view === 'signin' ? 'Welcome Back' : view === 'signup' ? 'Create Account' : 'Reset Password'}
            </h2>
            <p className="text-gray-500 mt-2">
              {view === 'signin' ? 'Enter your details to access your docs.' : 
               view === 'signup' ? 'Start signing documents in seconds.' : 
               'Enter your email to receive a reset link.'}
            </p>
          </div>

          {/* Messages */}
          {message && (
            <div className={`p-4 mb-6 rounded-lg flex items-center gap-3 text-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              {message.text}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                <input 
                  type="email" 
                  required
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {view !== 'forgot' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input 
                    type="password" 
                    required
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            {view === 'signin' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setView('forgot')} className="text-sm text-blue-600 hover:underline">
                  Forgot password?
                </button>
              </div>
            )}

            <button 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  {view === 'signin' ? 'Sign In' : view === 'signup' ? 'Get Started' : 'Send Link'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Footer Toggles */}
          <div className="mt-8 text-center text-sm text-gray-500">
            {view === 'signin' ? (
              <>
                New here? <button onClick={() => setView('signup')} className="text-blue-600 font-semibold hover:underline">Create an account</button>
              </>
            ) : (
              <>
                Already have an account? <button onClick={() => setView('signin')} className="text-blue-600 font-semibold hover:underline">Sign in</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}