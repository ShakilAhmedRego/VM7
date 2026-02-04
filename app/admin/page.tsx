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
  const [msgType, setMsgType] = useState<"success" | "error">("success")
  const [grantUserId, setGrantUserId] = useState("")
  const [grantAmount, setGrantAmount] = useState("")

  useEffect(() => {
    checkAndLoad()
  }, [])

  async function checkAndLoad() {
    const supabase = getSupabase()

    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData?.session

    if (!session) {
      router.push("/login")
      return
    }

    const userId = session.user.id

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single()

    if (error || !profile || profile.role !== "admin") {
      router.push("/dashboard")
      return
    }

    await fetchData()
    setLoading(false)
  }

  async function fetchData() {
    const supabase = getSupabase()

    const { data: leadsData } = await supabase
      .from("leads")
      .select("*")
      .order("created_date", { ascending: false })

    if (leadsData) setLeads(leadsData as Lead[])

    const { data: usersData } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (usersData) setUsers(usersData as UserRow[])
  }

  function showMsg(text: string, type: "success" | "error") {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(""), 4000)
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = async event => {
      try {
        const text = String(event.target?.result || "")
        const lines = text.split("\n").filter(l => l.trim())

        if (lines.length < 2) {
          showMsg("CSV must have header + rows.", "error")
          return
        }

        const headers = lines[0]
          .split(",")
          .map(h => h.trim().replace(/"/g, "").toLowerCase())

        const col = (row: string[], name: string) => {
          const i = headers.indexOf(name)
          return i === -1 ? "" : (row[i] || "").replace(/"/g, "").trim()
        }

        const newLeads: Record<string, string>[] = []

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",")

          newLeads.push({
            lead_id: `LEAD-${Date.now()}-${i}`,
            company_name: col(cols, "company_name") || col(cols, "company") || "Unknown",
            contact_name: col(cols, "contact_name") || col(cols, "contact"),
            email: col(cols, "email"),
            phone: col(cols, "phone"),
            industry: col(cols, "industry"),
            location: col(cols, "location"),
            company_size: col(cols, "company_size"),
            revenue_range: col(cols, "revenue_range"),
            capital_need: col(cols, "capital_need"),
            status: "available"
          })
        }

        if (!newLeads.length) {
          showMsg("No rows found.", "error")
          return
        }

        const supabase = getSupabase()

        const { error } = await supabase.from("leads").insert(newLeads)

        if (error) {
          showMsg(error.message, "error")
          return
        }

        await fetchData()
        showMsg(`Imported ${newLeads.length} leads`, "success")
      } catch {
        showMsg("CSV parse failed.", "error")
      }
    }

    reader.readAsText(file)
    e.target.value = ""
  }

  async function handleGrant() {
    const amount = Number(grantAmount)
    if (!grantUserId || amount <= 0) return

    const supabase = getSupabase()
    const user = users.find(u => u.id === grantUserId)

    const newCredits = (user?.credits || 0) + amount

    await supabase
      .from("user_profiles")
      .update({ credits: newCredits })
      .eq("id", grantUserId)

    await supabase.from("credit_transactions").insert({
      user_id: grantUserId,
      amount,
      type: "grant",
      description: `Admin granted ${amount} credits`
    })

    setGrantUserId("")
    setGrantAmount("")
    await fetchData()

    showMsg("Credits granted", "success")
  }

  async function handleLogout() {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 rounded-full border-b-2 border-purple-600" />
      </div>
    )
  }

  const clientUsers = users.filter(u => u.role === "client")
  const totalCredits = users.reduce((sum, u) => sum + (u.credits || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {msg && (
        <div className={`fixed top-4 right-4 px-5 py-3 rounded-xl text-white ${
          msgType === "success" ? "bg-green-500" : "bg-red-500"
        }`}>
          {msg}
        </div>
      )}

      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <button onClick={handleLogout} className="flex items-center gap-2 text-red-600">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-
