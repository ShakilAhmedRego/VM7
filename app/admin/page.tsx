"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { getSupabase } from "@/lib/supabase"
import { Upload, Users, Database, LogOut, Coins } from "lucide-react"

interface Lead {
  id: string
  company_name: string
  contact_name: string
  email: string
  industry: string
  location: string
  capital_need: string
}

interface UserRow {
  id: string
  email: string
  name: string
  company: string
  credits: number
  role: string
}

export default function AdminPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")
  const [grantUserId, setGrantUserId] = useState("")
  const [grantAmount, setGrantAmount] = useState("")

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const supabase = getSupabase()

    const { data } = await supabase.auth.getSession()
    const session = data?.session

    if (!session) {
      router.push("/login")
      return
    }

    const userId = session.user.id

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single()

    if (!profile || profile.role !== "admin") {
      router.push("/dashboard")
      return
    }

    await loadData()
    setLoading(false)
  }

  async function loadData() {
    const supabase = getSupabase()

    const { data: leadsData } = await supabase
      .from("leads")
      .select("*")
      .order("created_date", { ascending: false })

    if (leadsData) setLeads(leadsData)

    const { data: usersData } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (usersData) setUsers(usersData)
  }

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(""), 3000)
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = async ev => {
      const text = String(ev.target?.result || "")
      const rows = text.split("\n").filter(r => r.trim())

      if (rows.length < 2) return flash("Invalid CSV")

      const headers = rows[0].split(",").map(h => h.toLowerCase().trim())

      const val = (r: string[], name: string) =>
        r[headers.indexOf(name)] || ""

      const batch = rows.slice(1).map((r, i) => {
        const c = r.split(",")
        return {
          lead_id: `LEAD-${Date.now()}-${i}`,
          company_name: val(c, "company_name") || val(c, "company"),
          contact_name: val(c, "contact_name"),
          email: val(c, "email"),
          industry: val(c, "industry"),
          location: val(c, "location"),
          capital_need: val(c, "capital_need"),
          status: "available"
        }
      })

      const supabase = getSupabase()
      await supabase.from("leads").insert(batch)
      await loadData()

      flash(`Imported ${batch.length} leads`)
    }

    reader.readAsText(file)
    e.target.value = ""
  }

  async function grantCredits() {
    const amt = Number(grantAmount)
    if (!grantUserId || amt <= 0) return

    const supabase = getSupaba
