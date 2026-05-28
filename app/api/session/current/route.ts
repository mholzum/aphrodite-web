import { NextRequest, NextResponse } from 'next/server'

// Returns the session token from the httpOnly cookie — readable server-side
export async function GET(req: NextRequest) {
  const token = req.cookies.get('aphrodite_session')?.value
  if (!token) return NextResponse.json({ error: 'No session' }, { status: 401 })
  return NextResponse.json({ token })
}
