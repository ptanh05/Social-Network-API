import { NextResponse } from 'next/server'

export class AppError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
  }
}

export const ok = (data) => NextResponse.json(data)
export const created = (data) => NextResponse.json(data, { status: 201 })
export const noContent = () => new NextResponse(null, { status: 204 })
export const err = (status, msg) => NextResponse.json({ detail: msg }, { status })
