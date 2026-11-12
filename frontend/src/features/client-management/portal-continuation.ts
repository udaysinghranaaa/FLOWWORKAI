let token: string | undefined
export const rememberPortalInvitation = (value: string) => {
  token = value
}
export const pendingPortalInvitation = () => token
export const clearPortalInvitation = () => {
  token = undefined
}
