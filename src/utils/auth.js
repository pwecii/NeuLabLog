export function isNeuEmail(email = '') {
return /@neu\.edu\.ph$/i.test(email.trim())
}
export function canAccessAdmin(profile) {
return profile?.role === 'admin'
}
export function canAccessProfessor(profile) {
return profile?.role === 'professor'
}