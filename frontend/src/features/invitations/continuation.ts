// Transient browser memory only; never persist bearer invitation credentials.
let invitation: string | undefined
export const pendingInvitation = () => invitation
export const rememberInvitation = (token: string) => {
  invitation = token
}
export const clearInvitation = () => {
  invitation = undefined
}
