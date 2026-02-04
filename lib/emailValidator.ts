var blockedDomains = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "mail.com",
  "protonmail.com",
  "zoho.com",
  "yandex.com",
  "temp.com",
  "mailinator.com",
  "guerrillamail.com",
  "sharklasers.com",
  "trashmail.com"
]

export function isWorkEmail(email: string): boolean {
  var parts = email.toLowerCase().split("@")
  if (parts.length !== 2) return false
  var domain = parts[1]
  for (var i = 0; i < blockedDomains.length; i++) {
    if (domain === blockedDomains[i]) return false
  }
  return true
}
