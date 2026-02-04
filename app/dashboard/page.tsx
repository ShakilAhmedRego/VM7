"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabase } from "@/lib/supabase"
import { exportToCSV } from "@/lib/csv"
import { Shield, Download, LogOut, Coins, Search, Lock, Unlock } from "lucide-react"

interface Lead {
  id: string
  lead_id: string
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

interface Profile {
  id: string
  email: string
  name: string
  company: string
  credits: number
  role: string
  status: string
}

interface DownloadRecord {
  lead_id: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [history, setHistory] = useState<DownloadRecord[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [industryFilter, setIndustryFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")
  const [msgType, setMsgType] = useState("success")

  useEffect(() => {
    loadAll()
  }, [])

  var loadAll = async function () {
    var supabase = getSupabase()
    var sessionRes = await supabase.auth.getSession()
    if (!sessionRes.data || !sessionRes.data.session) {
      router.push("/login")
      return
    }
    var userId = sessionRes.data.session.user.id

    var profileRes = await supabase.from("user_profiles").select("*").eq("id", userId).single()
    if (profileRes.data) {
      var p = profileRes.data as Profile
      if (p.role === "admin") {
        router.push("/admin")
        return
      }
      setProfile(p)
    }

    var leadsRes = await supabase.from("leads").select("*").eq("status", "available").order("created_date", { ascending: false })
    if (leadsRes.data) {
      setLeads(leadsRes.data as Lead[])
    }

    var histRes = await supabase.from("download_history").select("lead_id").eq("user_id", userId)
    if (histRes.data) {
      setHistory(histRes.data as DownloadRecord[])
    }

    setLoading(false)
  }

  var showMsg = function (text: string, type: string) {
    setMsg(text)
    setMsgType(type)
    setTimeout(function () { setMsg("") }, 4000)
  }

  var alreadyDownloaded = function (leadId: string): boolean {
    for (var i = 0; i < history.length; i++) {
      if (history[i].lead_id === leadId) return true
    }
    return false
  }

  var industries = ["all"]
  for (var i = 0; i < leads.length; i++) {
    if (leads[i].industry && industries.indexOf(leads[i].industry) === -1) {
      industries.push(leads[i].industry)
    }
  }

  var filtered = leads.filter(function (lead) {
    var matchSearch = true
    if (search.length > 0) {
      var s = search.toLowerCase()
      matchSearch = (lead.company_name || "").toLowerCase().indexOf(s) !== -1 ||
        (lead.contact_name || "").toLowerCase().indexOf(s) !== -1
    }
    var matchIndustry = industryFilter === "all" || lead.industry === industryFilter
    return matchSearch && matchIndustry
  })

  var toggleSelect = function (id: string) {
    if (selected.indexOf(id) !== -1) {
      setSelected(selected.filter(function (x) { return x !== id }))
    } else {
      setSelected(selected.concat([id]))
    }
  }

  var selectAll = function () {
    if (selected.length === filtered.length) {
      setSelected([])
    } else {
      setSelected(filtered.map(function (l) { return l.id }))
    }
  }

  var calcCost = function (): number {
    var cost = 0
    for (var i = 0; i < selected.length; i++) {
      if (!alreadyDownloaded(selected[i])) cost++
    }
    return cost
  }

  var handleDownload = async function () {
    if (selected.length === 0) {
      showMsg("Select at least one lead first.", "error")
      return
    }
    var cost = calcCost()
    if (cost > 0 && (profile ? profile.credits : 0) < cost) {
      showMsg("Not enough credits. You need " + cost + " but have " + (profile ? profile.credits : 0) + ".", "error")
      return
    }

    var supabase = getSupabase()
    var userId = profile ? profile.id : ""

    var toDownload: Lead[] = []
    for (var i = 0; i < leads.length; i++) {
      if (selected.indexOf(leads[i].id) !== -1) {
        toDownload.push(leads[i])
      }
    }

    var rows: Record<string, string>[] = []
    for (var i = 0; i < toDownload.length; i++) {
      rows.push({
        "Company Name": toDownload[i].company_name || "",
        "Contact Name": toDownload[i].contact_name || "",
        "Email": toDownload[i].email || "",
        "Phone": toDownload[i].phone || "",
        "Industry": toDownload[i].industry || "",
        "Location": toDownload[i].location || "",
        "Company Size": toDownload[i].company_size || "",
        "Revenue Range": toDownload[i].revenue_range || "",
        "Capital Need": toDownload[i].capital_need || ""
      })
    }

    var today = new Date().toISOString().split("T")[0]
    exportToCSV(rows, "verifiedmeasure_leads_" + today + ".csv")

    var newLeadIds: string[] = []
    for (var i = 0; i < selected.length; i++) {
      if (!alreadyDownloaded(selected[i])) {
        newLeadIds.push(selected[i])
      }
    }

    if (newLeadIds.length > 0) {
      await supabase.from("user_profiles").update({ credits: (profile ? profile.credits : 0) - cost }).eq("id", userId)

      for (var i = 0; i < newLeadIds.length; i++) {
        await supabase.from("download_history").insert({ user_id: userId, lead_id: newLeadIds[i] })
      }

      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount: -cost,
        type: "deduct",
        description: "Downloaded " + cost + " leads"
      })
    }

    setSelected([])
    showMsg("Downloaded " + toDownload.length + " leads! Cost: " + cost + " credits.", "success")
    loadAll()
  }

  var handleLogout = async function () {
    var supabase = getSupabase()
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    )
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

      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">VerifiedMeasure</h1>
              <p className="text-xs text-gray-500">Welcome, {profile ? profile.name : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-xl font-bold text-blue-700">{profile ? profile.credits : 0}</span>
              <span className="text-xs text-gray-500">credits</span>
            </div>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-gray-700">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border p-4 mb-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={function (e) { setSearch(e.target.value) }}
                placeholder="Company or contact..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
            <select value={industryFilter} onChange={function (e) { setIndustryFilter(e.target.value) }} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {industries.map(function (ind) {
                return <option key={ind} value={ind}>{ind === "all" ? "All Industries" : ind}</option>
              })}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4 mb-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={selectAll} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
              {selected.length === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
            </button>
            <span className="text-sm text-gray-600">{selected.length} selected</span>
          </div>
          <button
            onClick={handleDownload}
            disabled={selected.length === 0}
            className={selected.length > 0 ? "bg-blue-600 text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-blue-700" : "bg-gray-300 text-gray-500 px-5 py-2 rounded-xl font-semibold flex items-center gap-2 cursor-not-allowed"}
          >
            <Download className="w-4 h-4" />
            Download ({calcCost()} credits)
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Select</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Industry</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Capital Need</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No leads found</td>
                  </tr>
                )}
                {filtered.map(function (lead) {
                  var isSelected = selected.indexOf(lead.id) !== -1
                  var wasDownloaded = alreadyDownloaded(lead.id)
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={function () { toggleSelect(lead.id) }}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{lead.company_name}</div>
                        <div className="text-xs text-gray-500">
                          {wasDownloaded ? (
                            lead.email
                          ) : (
                            <span className="blur-sm select-none" title="Download to unlock">
                              {lead.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{lead.contact_name}</div>
                        <div className="text-xs text-gray-500">
                          {wasDownloaded ? (
                            lead.phone
                          ) : (
                            <span className="blur-sm select-none" title="Download to unlock">
                              {lead.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg text-xs font-medium">{lead.industry}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{lead.location}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-green-700">{lead.capital_need}</div>
                        {wasDownloaded ? (
                          <div className="flex items-center gap-1">
                            <Unlock className="w-3 h-3 text-green-600" />
                            <span className="text-xs text-green-600 font-medium">Unlocked - FREE re-download</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Lock className="w-3 h-3 text-orange-600" />
                            <span className="text-xs text-orange-600 font-medium">Locked - 1 credit</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 mt-8">
          Showing {filtered.length} leads | VerifiedMeasure 2026
        </div>
      </div>
    </div>
  )
}
