"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabase } from "@/lib/supabase"
import { isWorkEmail } from "@/lib/emailValidator"
import { Shield, CheckCircle } from "lucide-react"

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    var supabase = getSupabase()
    supabase.auth.getSession().then(function (res) {
      if (res.data && res.data.session) {
        router.push("/dashboard")
      } else {
        setChecking(false)
      }
    })
  }, [router])

  var handleSignup = async function (e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!isWorkEmail(email)) {
      setError("Please use a work email address. Personal emails (Gmail, Yahoo, etc.) are not allowed.")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      setLoading(false)
      return
    }

    var supabase = getSupabase()

    var result = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: window.location.origin + "/login"
      }
    })

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    if (result.data && result.data.user) {
      var profileResult = await supabase.from("user_profiles").insert({
        id: result.data.user.id,
        email: email,
        name: name,
        company: company,
        credits: 0,
        role: "client",
        status: "active"
      })
      if (profileResult.error) {
        console.error("Profile insert error:", profileResult.error)
      }
    }

    setSuccess(true)
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account Created!</h2>
          <p className="text-gray-600 mb-4">
            Please check your email inbox and click the verification link to activate your account.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Once verified, you can sign in and start browsing leads.
          </p>
          <a href="/login" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700">
            Back to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
            <p className="text-gray-500 text-sm mt-1">Work email required</p>
          </div>

          <form onSubmit={handleSignup} noValidate>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={function (e) { setName(e.target.value) }}
                placeholder="John Smith"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input
                type="text"
                value={company}
                onChange={function (e) { setCompany(e.target.value) }}
                placeholder="Your Company"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={function (e) { setEmail(e.target.value) }}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={function (e) { setPassword(e.target.value) }}
                placeholder="Min 6 characters"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-blue-600 font-semibold hover:underline">Sign In</a>
          </p>
        </div>
      </div>
    </div>
  )
}
