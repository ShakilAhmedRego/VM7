"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { getSupabase } from "@/lib/supabase"
import { Shield, Upload, Users, Database, LogOut, Coins } from "lucide-react"

interface Lead {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  industry: string
  location: string
  company_size: string
  revenue_range: string
  capital_need: string
  status: string
}

interface UserRow {
  id: string
  email: string
  name: string
  company: string
  credits: number
  role: string
  status: string
}

export default function AdminPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")
  const [msgType, setMsgType] = useState("success")
  const [grantUserId, setGrantUserId] = useState("")
  const [grantAmount, setGrantAmount] = useState("")

  useEffect(() => {
    checkAndLoad()
  }, [])

  var checkAndLoad = async function () {
    var supabase = getSupabase()
    var sessionRes = await supabase.auth.getSession()
    if (!sessionRes.data || !sessionRes.data.session) {
      router.push("/login")
      return
    }
    var userId = sessionRes.data.session.user.id
    var profileRes = await supabase.from("user_profiles").select("role").eq("id", userId).single()
    if (!profileRes.data || (profileRes.data as { role: string }).role !== "admin") {
      router.push("/dashboard")
      return
    }
    await fetchData()
    setLoading(false)
  }

  var fetchData = async function () {
    var supabase = getSupabase()
    var leadsRes = await supabase.from("leads").select("*").order("created_date", { ascending: false })
    if (leadsRes.data) setLeads(leadsRes.data as Lead[])

    var usersRes = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false })
    if (usersRes.data) setUsers(usersRes.data as UserRow[])
  }

  var showMsg = function (text: string, type: string) {
    setMsg(text)
    setMsgType(type)
    setTimeout(function () { setMsg("") }, 4000)
  }

  var handleCSV = function (e: React.ChangeEvent<HTMLInputElement>) {
    var file = e.target.files ? e.target.files[0] : null
    if (!file) return
    var reader = new FileReader()
    reader.onload = async function (event) {
      try {
        var text = event.target && event.target.result ? String(event.target.result) : ""
        var lines = text.split("\n")
        if (lines.length < 2) {
          showMsg("CSV needs a header row and at least one data row.", "error")
          return
        }

        var headers = lines[0].split(",").map(function (h) { return h.trim().replace(/"/g, "").toLowerCase() })

        var getCol = function (row: string[], name: string): string {
          var idx = headers.indexOf(name)
          if (idx === -1) return ""
          return (row[idx] || "").trim().replace(/"/g, "")
        }

        var newLeads: Record<string, string>[] = []
        for (var i = 1; i < lines.length; i++) {
          if (lines[i].trim().length === 0) continue
          var cols = lines[i].split(",")
          newLeads.push({
            lead_id: "LEAD-" + Date.now() + "-" + i,
            company_name: getCol(cols, "company_name") || getCol(cols, "company") || "Unknown",
            contact_name: getCol(cols, "contact_name") || getCol(cols, "contact") || "",
            email: getCol(cols, "email") || "",
            phone: getCol(cols, "phone") || "",
            industry: getCol(cols, "industry") || "",
            location: getCol(cols, "location") || "",
            company_size: getCol(cols, "company_size") || getCol(cols, "company size") || "",
            revenue_range: getCol(cols, "revenue_range") || getCol(cols, "revenue") || "",
            capital_need: getCol(cols, "capital_need") || getCol(cols, "capital need") || "",
            status: "available"
          })
        }

        if (newLeads.length === 0) {
          showMsg("No valid rows found in CSV.", "error")
          return
        }

        var supabase = getSupabase()
        var result = await supabase.from("leads").insert(newLeads as any)
        if (result.error) {
          showMsg("Insert error: " + result.error.message, "error")
          return
        }

        await fetchData()
        showMsg("Imported " + newLeads.length + " leads successfully!", "success")
      } catch (err) {
        showMsg("CSV parse error. Check format.", "error")
      }
    }
    reader.readAsText(file)
    if (e.target) e.target.value = ""
  }

  var handleGrant = async function () {
    if (!grantUserId || !grantAmount) return
    var amount = parseInt(grantAmount)
    if (isNaN(amount) || amount <= 0) {
      showMsg("Enter a valid number.", "error")
      return
    }

    var supabase = getSupabase()
    var user = users.find(function (u) { return u.id === grantUserId })
    var newCredits = (user ? user.credits : 0) + amount

    await supabase.from("user_profiles").update({ credits: newCredits }).eq("id", grantUserId)
    await supabase.from("credit_transactions").insert({
      user_id: grantUserId,
      amount: amount,
      type: "grant",
      description: "Admin granted " + amount + " credits"
    } as any)

    setGrantUserId("")
    setGrantAmount("")
    await fetchData()
    showMsg("Granted " + amount + " credits!", "success")
  }

  var handleLogout = async function () {
    var supabase = getSupabase()
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  var clientUsers = users.filter(function (u) { return u.role === "client" })
  var totalCredits = 0
  for (var i = 0; i < users.length; i++) {
    totalCredits += users[i].credits || 0
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {msg && (
        <div className="fixed top-4 right-4 z-50">
          <div className={msgType === "success" ? "bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg font-medium" : "bg-red-500 text-white px-5 py-3 rounded-xl shadow-lg font-medium"}>
            {msg}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-purple-200 text-sm">VerifiedMeasure Management</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-xl">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Leads</p>
                <p className="text-3xl font-bold text-gray-900">{leads.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Active Clients</p>
                <p className="text-3xl font-bold text-gray-900">{clientUsers.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Credits</p>
                <p className="text-3xl font-bold text-gray-900">{totalCredits}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Coins className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Leads</h2>
            <div>
              <input type="file" ref={fileRef} onChange={handleCSV} accept=".csv" className="hidden" />
              <button onClick={function () { fileRef.current && fileRef.current.click() }} className="bg-green-600 text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-green-700">
                <Upload className="w-4 h-4" />
                Upload CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Company</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Industry</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Capital Need</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No leads yet. Upload a CSV to add leads.</td></tr>
                )}
                {leads.slice(0, 20).map(function (lead) {
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium">{lead.company_name}</div>
                        <div className="text-xs text-gray-500">{lead.email}</div>
                      </td>
                      <td className="px-4 py-2">{lead.contact_name}</td>
                      <td className="px-4 py-2">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg text-xs">{lead.industry}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{lead.location}</td>
                      <td className="px-4 py-2 font-semibold text-green-700">{lead.capital_need}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Users & Credits</h2>

          <div className="bg-gray-50 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Select User</label>
              <select value={grantUserId} onChange={function (e) { setGrantUserId(e.target.value) }} className="px-3 py-2 border border-gray-300 rounded-xl text-sm min-w-48 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">-- Pick a user --</option>
                {clientUsers.map(function (u) {
                  return <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Credits to Grant</label>
              <input
                type="number"
                value={grantAmount}
                onChange={function (e) { setGrantAmount(e.target.value) }}
                placeholder="100"
                className="px-3 py-2 border border-gray-300 rounded-xl text-sm w-28 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button onClick={handleGrant} disabled={!grantUserId || !grantAmount} className={grantUserId && grantAmount ? "bg-purple-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-purple-700" : "bg-gray-300 text-gray-500 px-5 py-2 rounded-xl font-semibold cursor-not-allowed"}>
              Grant Credits
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Company</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Credits</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No users yet.</td></tr>
                )}
                {users.map(function (u) {
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{u.name}</td>
                      <td className="px-4 py-2 text-gray-600">{u.email}</td>
                      <td className="px-4 py-2 text-gray-600">{u.company}</td>
                      <td className="px-4 py-2">
                        <span className="font-bold text-blue-600">{u.credits}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={u.role === "admin" ? "bg-purple-100 text-purple-800 px-2 py-0.5 rounded-lg text-xs font-semibold" : "bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg text-xs"}>
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
