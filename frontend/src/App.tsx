import { RouterProvider } from 'react-router'
import { router } from '@/routes/router'
import { Providers } from '@/app/providers'
export default function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}
